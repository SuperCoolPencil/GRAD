import * as SQLite from 'expo-sqlite';
import { Course, ScheduleItem, ExtraClass, AttendanceRecord } from '../types';

export let db = SQLite.openDatabaseSync('grad.db');

export const reopenDatabase = () => {
  db = SQLite.openDatabaseSync('grad.db');
}

export const initDatabase = () => {
  console.log('Initializing database...');
  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      required_attendance INTEGER NOT NULL,
      is_archived BOOLEAN NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS weekly_schedules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      day TEXT NOT NULL,
      time_start TEXT NOT NULL,
      time_end TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS extra_classes (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time_start TEXT NOT NULL,
      time_end TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      class_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'cancelled')),
      is_extra_class BOOLEAN NOT NULL,
      schedule_item_id TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  // Migration for older schemas
  const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(courses)');
  const columnNames = columns.map(c => c.name);

  if (columnNames.includes('presents')) {
    console.log('Migrating database: removing presents column');
    db.execSync('ALTER TABLE courses DROP COLUMN presents');
  }
  if (columnNames.includes('absents')) {
    console.log('Migrating database: removing absents column');
    db.execSync('ALTER TABLE courses DROP COLUMN absents');
  }
  if (columnNames.includes('cancelled')) {
    console.log('Migrating database: removing cancelled column');
    db.execSync('ALTER TABLE courses DROP COLUMN cancelled');
  }
  if (columnNames.includes('attendance_percentage')) {
    console.log('Migrating database: removing attendance_percentage column');
    db.execSync('ALTER TABLE courses DROP COLUMN attendance_percentage');
  }
  if (!columnNames.includes('is_archived')) {
    console.log('Migrating database: adding is_archived column');
    db.execSync('ALTER TABLE courses ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0');
  }

  console.log('Database initialized successfully');
};

export const getSettings = (): { [key: string]: string } => {
  console.log('Getting settings');
  const rows = db.getAllSync<{ key: string, value: string }>('SELECT * FROM app_settings');
  const settings: { [key: string]: string } = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
};

export const updateSetting = (key: string, value: string) => {
  console.log(`Updating setting: ${key} = ${value}`);
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', key, value);
};

const getCourseFromDbRow = (c: any): Course => {
  const weeklySchedule = db.getAllSync('SELECT * FROM weekly_schedules WHERE course_id = ?', c.id).map((s: any) => ({
    id: s.id,
    day: s.day,
    timeStart: s.time_start,
    timeEnd: s.time_end,
  }));

  const extraClasses = db.getAllSync('SELECT * FROM extra_classes WHERE course_id = ?', c.id).map((e: any) => ({
    id: e.id,
    date: e.date,
    timeStart: e.time_start,
    timeEnd: e.time_end,
  }));

  const attendanceRecords = db.getAllSync('SELECT * FROM attendance_records WHERE course_id = ?', c.id).map((r: any) => ({
    id: r.id,
    course_id: r.course_id,
    date: r.class_date,
    status: r.status,
    isExtraClass: r.is_extra_class === 1,
    scheduleItemId: r.schedule_item_id,
  }));

  const presents = attendanceRecords.filter(r => r.status === 'present').length;
  const absents = attendanceRecords.filter(r => r.status === 'absent').length;
  const cancelled = attendanceRecords.filter(r => r.status === 'cancelled').length;
  const totalClasses = presents + absents;
  const attendancePercentage = totalClasses > 0 ? Math.round((presents / totalClasses) * 100) : 100;

  return {
    id: c.id,
    name: c.name,
    requiredAttendance: c.required_attendance,
    isArchived: c.is_archived === 1,
    weeklySchedule,
    extraClasses,
    attendanceRecords,
    presents,
    absents,
    cancelled,
    attendancePercentage,
  };
}

export const getCourses = (): Course[] => {
  console.log('Getting all courses');
  const coursesFromDb = db.getAllSync('SELECT * FROM courses');
  return coursesFromDb.map(getCourseFromDbRow);
};

export const getCourseById = (courseId: string): Course | null => {
  console.log(`Getting course by id: ${courseId}`);
  const courseFromDb = db.getFirstSync('SELECT * FROM courses WHERE id = ?', courseId);
  if (!courseFromDb) {
    return null;
  }
  return getCourseFromDbRow(courseFromDb);
}

export const addCourse = (course: Course) => {
  console.log(`Adding course: ${course.name}`);
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT INTO courses (id, name, required_attendance, is_archived) VALUES (?, ?, ?, ?)',
      course.id, course.name, course.requiredAttendance, course.isArchived ? 1 : 0
    );
    course.weeklySchedule?.forEach(item => {
      db.runSync(
        'INSERT INTO weekly_schedules (id, course_id, day, time_start, time_end) VALUES (?, ?, ?, ?, ?)',
        item.id, course.id, item.day, item.timeStart, item.timeEnd
      );
    });
  });
};

export const updateCourse = (course: Course) => {
  console.log(`Updating course: ${course.name}`);
  db.withTransactionSync(() => {
    db.runSync(
      'UPDATE courses SET name = ?, required_attendance = ?, is_archived = ? WHERE id = ?',
      course.name, course.requiredAttendance, course.isArchived ? 1 : 0, course.id
    );

    // Update weekly schedules
    const existingScheduleIds = db.getAllSync<{ id: string }>('SELECT id FROM weekly_schedules WHERE course_id = ?', course.id).map(s => s.id);
    const newScheduleIds = course.weeklySchedule?.map(s => s.id) || [];
    const schedulesToDelete = existingScheduleIds.filter(id => !newScheduleIds.includes(id));
    if (schedulesToDelete.length > 0) {
      db.runSync(`DELETE FROM weekly_schedules WHERE id IN (${schedulesToDelete.map(() => '?').join(',')})`, ...schedulesToDelete);
    }
    course.weeklySchedule?.forEach(item => {
      db.runSync(
        'INSERT OR REPLACE INTO weekly_schedules (id, course_id, day, time_start, time_end) VALUES (?, ?, ?, ?, ?)',
        item.id, course.id, item.day, item.timeStart, item.timeEnd
      );
    });

    // Update extra classes
    const existingExtraClassIds = db.getAllSync<{ id: string }>('SELECT id FROM extra_classes WHERE course_id = ?', course.id).map(e => e.id);
    const newExtraClassIds = course.extraClasses?.map(e => e.id) || [];
    const extraClassesToDelete = existingExtraClassIds.filter(id => !newExtraClassIds.includes(id));
    if (extraClassesToDelete.length > 0) {
      db.runSync(`DELETE FROM extra_classes WHERE id IN (${extraClassesToDelete.map(() => '?').join(',')})`, ...extraClassesToDelete);
    }
    course.extraClasses?.forEach(item => {
      db.runSync(
        'INSERT OR REPLACE INTO extra_classes (id, course_id, date, time_start, time_end) VALUES (?, ?, ?, ?, ?)',
        item.id, course.id, item.date, item.timeStart, item.timeEnd
      );
    });

    // Update attendance records
    const existingAttendanceRecordIds = db.getAllSync<{ id: string }>('SELECT id FROM attendance_records WHERE course_id = ?', course.id).map(r => r.id);
    const newAttendanceRecordIds = course.attendanceRecords?.map(r => r.id) || [];
    const attendanceRecordsToDelete = existingAttendanceRecordIds.filter(id => !newAttendanceRecordIds.includes(id));
    if (attendanceRecordsToDelete.length > 0) {
      db.runSync(`DELETE FROM attendance_records WHERE id IN (${attendanceRecordsToDelete.map(() => '?').join(',')})`, ...attendanceRecordsToDelete);
    }
    course.attendanceRecords?.forEach(record => {
      db.runSync(
        'INSERT OR REPLACE INTO attendance_records (id, course_id, class_date, status, is_extra_class, schedule_item_id) VALUES (?, ?, ?, ?, ?, ?)',
        record.id, record.course_id, record.date, record.status, record.isExtraClass ? 1 : 0, record.scheduleItemId || null
      );
    });
  });
};

export const deleteCourse = (courseId: string) => {
  console.log(`Deleting course: ${courseId}`);
  db.runSync('DELETE FROM courses WHERE id = ?', courseId);
};

export const addAttendanceRecord = (record: AttendanceRecord) => {
  console.log(`Adding attendance record for course: ${record.course_id}`);
  db.runSync(
    'INSERT INTO attendance_records (id, course_id, class_date, status, is_extra_class, schedule_item_id) VALUES (?, ?, ?, ?, ?, ?)',
    record.id, record.course_id, record.date, record.status, record.isExtraClass ? 1 : 0, record.scheduleItemId || null
  );
};

export const addScheduleItem = (courseId: string, item: ScheduleItem) => {
  console.log(`Adding schedule item for course: ${courseId}`);
  db.runSync(
    'INSERT INTO weekly_schedules (id, course_id, day, time_start, time_end) VALUES (?, ?, ?, ?, ?)',
    item.id, courseId, item.day, item.timeStart, item.timeEnd
  );
};

export const deleteScheduleItem = (itemId: string) => {
  console.log(`Deleting schedule item: ${itemId}`);
  db.runSync('DELETE FROM weekly_schedules WHERE id = ?', itemId);
};

export const addExtraClass = (courseId: string, item: ExtraClass) => {
  console.log(`Adding extra class for course: ${courseId}`);
  db.runSync(
    'INSERT INTO extra_classes (id, course_id, date, time_start, time_end) VALUES (?, ?, ?, ?, ?)',
    item.id, courseId, item.date, item.timeStart, item.timeEnd
  );
};

export const clearAllData = () => {
  console.log('Clearing all data');
  db.withTransactionSync(() => {
    db.execSync('DROP TABLE IF EXISTS courses');
    db.execSync('DROP TABLE IF EXISTS weekly_schedules');
    db.execSync('DROP TABLE IF EXISTS extra_classes');
    db.execSync('DROP TABLE IF EXISTS attendance_records');
    db.execSync('DROP TABLE IF EXISTS app_settings');
  });
  initDatabase(); // Re-initialize the database with the correct schema
  // Re-insert default settings
  db.runSync("INSERT INTO app_settings (key, value) VALUES ('theme', 'light')");
  db.runSync("INSERT INTO app_settings (key, value) VALUES ('notificationTime', '10')");
  db.runSync("INSERT INTO app_settings (key, value) VALUES ('notificationsEnabled', 'false')");
  db.runSync("INSERT INTO app_settings (key, value) VALUES ('is24Hour', 'false')");
};
