import * as SQLite from 'expo-sqlite';
import { Course, ScheduleItem, ExtraClass, AttendanceRecord } from '../types';
import { formatDateToISO } from './dateHelpers';

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
      is_archived BOOLEAN NOT NULL DEFAULT 0,
      presents INTEGER NOT NULL DEFAULT 0,
      absents INTEGER NOT NULL DEFAULT 0,
      cancelled INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      show_in_tracker BOOLEAN NOT NULL DEFAULT 1,
      show_in_heatmap BOOLEAN NOT NULL DEFAULT 1,
      show_in_radar BOOLEAN NOT NULL DEFAULT 1,
      created_at TEXT,
      archived_at TEXT
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
      time_start TEXT NOT NULL,
      time_end TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'cancelled')),
      is_extra_class BOOLEAN NOT NULL,
      schedule_item_id TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  // Migration for older schemas
  const attendanceColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(attendance_records)');
  const attendanceColumnNames = attendanceColumns.map(c => c.name);

  if (!attendanceColumnNames.includes('time_start')) {
    console.log('Migrating database: adding time_start column to attendance_records');
    db.execSync('ALTER TABLE attendance_records ADD COLUMN time_start TEXT NOT NULL DEFAULT "00:00"');
  }

  if (!attendanceColumnNames.includes('time_end')) {
    console.log('Migrating database: adding time_end column to attendance_records');
    db.execSync('ALTER TABLE attendance_records ADD COLUMN time_end TEXT NOT NULL DEFAULT "00:00"');
  }

  const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(courses)');
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('is_archived')) {
    console.log('Migrating database: adding is_archived column');
    db.execSync('ALTER TABLE courses ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0');
  }
  if (!columnNames.includes('presents')) {
    console.log('Migrating database: adding presents column');
    db.execSync('ALTER TABLE courses ADD COLUMN presents INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnNames.includes('absents')) {
    console.log('Migrating database: adding absents column');
    db.execSync('ALTER TABLE courses ADD COLUMN absents INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnNames.includes('cancelled')) {
    console.log('Migrating database: adding cancelled column');
    db.execSync('ALTER TABLE courses ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0');
  }

  if (!columnNames.includes('color')) {
    console.log('Migrating database: adding color column');
    db.execSync('ALTER TABLE courses ADD COLUMN color TEXT');
  }

  if (!columnNames.includes('created_at')) {
    console.log('Migrating database: adding created_at column');
    db.execSync('ALTER TABLE courses ADD COLUMN created_at TEXT');
  }

  if (!columnNames.includes('archived_at')) {
    console.log('Migrating database: adding archived_at column');
    db.execSync('ALTER TABLE courses ADD COLUMN archived_at TEXT');
  }

  if (!columnNames.includes('show_in_tracker')) {
    console.log('Migrating database: adding show_in_tracker column');
    db.execSync('ALTER TABLE courses ADD COLUMN show_in_tracker BOOLEAN NOT NULL DEFAULT 1');
  }

  if (!columnNames.includes('show_in_heatmap')) {
    console.log('Migrating database: adding show_in_heatmap column');
    db.execSync('ALTER TABLE courses ADD COLUMN show_in_heatmap BOOLEAN NOT NULL DEFAULT 1');
  }

  if (!columnNames.includes('show_in_radar')) {
    console.log('Migrating database: adding show_in_radar column');
    db.execSync('ALTER TABLE courses ADD COLUMN show_in_radar BOOLEAN NOT NULL DEFAULT 1');
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

export const getSetting = (key: string): string | null => {
  console.log(`Getting setting: ${key}`);
  const result = db.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
  return result ? result.value : null;
};

export const updateSetting = (key: string, value: string) => {
  console.log(`Updating setting: ${key} = ${value}`);
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', key, value);
};

const getAttendanceRecordsForCourseInRange = (courseId: string, startDate: string, endDate: string): AttendanceRecord[] => {
  return db.getAllSync(
    'SELECT * FROM attendance_records WHERE course_id = ? AND class_date BETWEEN ? AND ? ORDER BY class_date ASC, time_start ASC',
    courseId,
    startDate,
    endDate
  ).map((r: any) => ({
    id: r.id,
    course_id: r.course_id,
    date: r.class_date,
    status: r.status,
    isExtraClass: r.is_extra_class === 1,
    scheduleItemId: r.schedule_item_id,
    timeStart: r.time_start,
    timeEnd: r.time_end,
  }));
};

const getCourseFromDbRow = (
  c: any,
  allSchedules: any[],
  allExtraClasses: any[],
  allAttendanceRecords: any[]
): Course => {
  const weeklySchedule = allSchedules
    .filter(s => s.course_id === c.id)
    .map((s: any) => ({
      id: s.id,
      day: s.day,
      timeStart: s.time_start,
      timeEnd: s.time_end,
    }));

  const extraClasses = allExtraClasses
    .filter(e => e.course_id === c.id)
    .map((e: any) => ({
      id: e.id,
      date: e.date,
      timeStart: e.time_start,
      timeEnd: e.time_end,
    }));

  const attendanceRecords = allAttendanceRecords
    .filter(r => r.course_id === c.id)
    .map((r: any) => ({
      id: r.id,
      course_id: r.course_id,
      date: r.class_date,
      status: r.status,
      isExtraClass: r.is_extra_class === 1,
      scheduleItemId: r.schedule_item_id,
      timeStart: r.time_start,
      timeEnd: r.time_end,
    }));

  const presents = c.presents;
  const absents = c.absents;
  const cancelled = c.cancelled;
  const totalClasses = presents + absents;
  const attendancePercentage = totalClasses > 0 ? Math.round((presents / totalClasses) * 100) : 100;

  return {
    id: c.id,
    name: c.name,
    color: c.color,
    requiredAttendance: c.required_attendance,
    isArchived: c.is_archived === 1,
    weeklySchedule,
    extraClasses,
    attendanceRecords,
    presents,
    absents,
    cancelled,
    attendancePercentage,
    showInTracker: c.show_in_tracker === 1,
    showInHeatmap: c.show_in_heatmap === 1,
    showInRadar: c.show_in_radar === 1,
    createdAt: c.created_at,
    archivedAt: c.archived_at,
  };
}

export const getCourses = (): Course[] => {
  console.log('Getting all courses');
  const coursesFromDb = db.getAllSync<any>('SELECT * FROM courses');
  const courseIds = coursesFromDb.map((c: any) => c.id);

  if (courseIds.length === 0) return [];

  const allSchedules = db.getAllSync(`SELECT * FROM weekly_schedules WHERE course_id IN (${courseIds.map(() => '?').join(',')})`, ...courseIds);
  const allExtraClasses = db.getAllSync(`SELECT * FROM extra_classes WHERE course_id IN (${courseIds.map(() => '?').join(',')})`, ...courseIds);
  const allAttendanceRecords = db.getAllSync(`SELECT * FROM attendance_records WHERE course_id IN (${courseIds.map(() => '?').join(',')}) ORDER BY class_date ASC, time_start ASC`, ...courseIds);

  return coursesFromDb.map((c: any) => getCourseFromDbRow(c, allSchedules, allExtraClasses, allAttendanceRecords));
};

export const getCoursesWithRecordsInRange = (startDate: string, endDate: string): Course[] => {
  console.log(`Getting courses with records between ${startDate} and ${endDate}`);
  const coursesFromDb = db.getAllSync<any>('SELECT * FROM courses');
  const courseIds = coursesFromDb.map((c: any) => c.id);

  if (courseIds.length === 0) return [];

  const allSchedules = db.getAllSync(`SELECT * FROM weekly_schedules WHERE course_id IN (${courseIds.map(() => '?').join(',')})`, ...courseIds);
  const allExtraClasses = db.getAllSync(`SELECT * FROM extra_classes WHERE course_id IN (${courseIds.map(() => '?').join(',')})`, ...courseIds);
  const allAttendanceRecords = db.getAllSync(`SELECT * FROM attendance_records WHERE course_id IN (${courseIds.map(() => '?').join(',')}) AND class_date BETWEEN ? AND ? ORDER BY class_date ASC, time_start ASC`, ...courseIds, startDate, endDate);

  return coursesFromDb.map((c: any) => getCourseFromDbRow(c, allSchedules, allExtraClasses, allAttendanceRecords));
}

export const getWeeklySchedule = (): (ScheduleItem & { course: Course })[] => {
  console.log('Getting weekly schedule');
  const scheduleFromDb = db.getAllSync(`
    SELECT ws.*, c.id as course_id, c.name as course_name, c.required_attendance, c.is_archived, c.presents, c.absents, c.cancelled
    FROM weekly_schedules ws
    JOIN courses c ON ws.course_id = c.id
    WHERE c.is_archived = 0
  `);
  return scheduleFromDb.map((s: any) => ({
    id: s.id,
    day: s.day,
    timeStart: s.time_start,
    timeEnd: s.time_end,
    course: {
      id: s.course_id,
      name: s.course_name,
      requiredAttendance: s.required_attendance,
      isArchived: s.is_archived === 1,
      presents: s.presents,
      absents: s.absents,
      cancelled: s.cancelled,
    }
  }));
};

export const updateCourseCounts = (courseId: string, presents: number, absents: number, cancelled: number) => {
  console.log(`Updating counts for course: ${courseId}`);
  db.runSync(
    'UPDATE courses SET presents = ?, absents = ?, cancelled = ? WHERE id = ?',
    presents, absents, cancelled, courseId
  );
};

export const getCourseById = (courseId: string): Course | null => {
  console.log(`Getting course by id: ${courseId}`);
  const courseFromDb = db.getFirstSync('SELECT * FROM courses WHERE id = ?', courseId);
  if (!courseFromDb) {
    return null;
  }
  const allSchedules = db.getAllSync('SELECT * FROM weekly_schedules WHERE course_id = ?', courseId);
  const allExtraClasses = db.getAllSync('SELECT * FROM extra_classes WHERE course_id = ?', courseId);
  const allAttendanceRecords = db.getAllSync('SELECT * FROM attendance_records WHERE course_id = ? ORDER BY class_date ASC, time_start ASC', courseId);
  return getCourseFromDbRow(courseFromDb, allSchedules, allExtraClasses, allAttendanceRecords);
}

export const addCourse = (course: Course) => {
  console.log(`Adding course: ${course.name}`);
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT INTO courses (id, name, required_attendance, is_archived, presents, absents, cancelled, color, show_in_tracker, show_in_heatmap, show_in_radar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      course.id, course.name, course.requiredAttendance, course.isArchived ? 1 : 0, course.presents || 0, course.absents || 0, course.cancelled || 0, course.color || null, course.showInTracker !== false ? 1 : 0, course.showInHeatmap !== false ? 1 : 0, course.showInRadar !== false ? 1 : 0, formatDateToISO(new Date())
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
  console.log(`[DB] Updating course: ${course.name}`);
  db.withTransactionSync(() => {
    db.runSync(
      'UPDATE courses SET name = ?, required_attendance = ?, presents = ?, absents = ?, cancelled = ?, color = ?, show_in_tracker = ?, show_in_heatmap = ?, show_in_radar = ? WHERE id = ?',
      course.name, course.requiredAttendance, course.presents, course.absents, course.cancelled, course.color || null, course.showInTracker ? 1 : 0, course.showInHeatmap ? 1 : 0, course.showInRadar ? 1 : 0, course.id
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
    const newAttendanceRecordIds = new Set(course.attendanceRecords?.map(r => r.id) || []);
    const existingAttendanceRecordIds = new Set(db.getAllSync<{ id: string }>('SELECT id FROM attendance_records WHERE course_id = ?', course.id).map(r => r.id));

    const recordsToDelete = [...existingAttendanceRecordIds].filter(id => !newAttendanceRecordIds.has(id));
    if (recordsToDelete.length > 0) {
        db.runSync(`DELETE FROM attendance_records WHERE id IN (${recordsToDelete.map(() => '?').join(',')})`, ...recordsToDelete);
    }

    course.attendanceRecords?.forEach(record => {
        if (existingAttendanceRecordIds.has(record.id)) {
            // Update existing record
            db.runSync(
                'UPDATE attendance_records SET class_date = ?, status = ?, is_extra_class = ?, schedule_item_id = ?, time_start = ?, time_end = ? WHERE id = ?',
                record.date, record.status, record.isExtraClass ? 1 : 0, record.scheduleItemId || null, record.timeStart, record.timeEnd, record.id
            );
        } else {
            // Insert new record
            db.runSync(
                'INSERT INTO attendance_records (id, course_id, class_date, status, is_extra_class, schedule_item_id, time_start, time_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                record.id, record.course_id, record.date, record.status, record.isExtraClass ? 1 : 0, record.scheduleItemId || null, record.timeStart, record.timeEnd
            );
        }
    });
  });
};

export const updateAttendanceRecord = (recordId: string, newStatus: "present" | "absent" | "cancelled") => {
  console.log(`[DB] Updating attendance record ${recordId} to status: ${newStatus}`);
  db.withTransactionSync(() => {
    const existingRecord = db.getFirstSync<AttendanceRecord>('SELECT * FROM attendance_records WHERE id = ?', recordId);

    if (!existingRecord) {
      console.log(`[DB] Attendance record not found: ${recordId}`);
      return;
    }

    if (existingRecord.status === newStatus) {
      console.log(`[DB] Status for record ${recordId} is already ${newStatus}. No update needed.`);
      return;
    }

    // Update the attendance record status
    db.runSync(
      'UPDATE attendance_records SET status = ? WHERE id = ?',
      newStatus, recordId
    );

    // Adjust course counts based on status change
    const courseId = existingRecord.course_id;
    const oldStatus = existingRecord.status;

    // Decrement count for old status
    if (oldStatus === 'present') {
      db.runSync('UPDATE courses SET presents = presents - 1 WHERE id = ?', courseId);
    } else if (oldStatus === 'absent') {
      db.runSync('UPDATE courses SET absents = absents - 1 WHERE id = ?', courseId);
    } else if (oldStatus === 'cancelled') {
      db.runSync('UPDATE courses SET cancelled = cancelled - 1 WHERE id = ?', courseId);
    }

    // Increment count for new status
    if (newStatus === 'present') {
      db.runSync('UPDATE courses SET presents = presents + 1 WHERE id = ?', courseId);
    } else if (newStatus === 'absent') {
      db.runSync('UPDATE courses SET absents = absents + 1 WHERE id = ?', courseId);
    } else if (newStatus === 'cancelled') {
      db.runSync('UPDATE courses SET cancelled = cancelled + 1 WHERE id = ?', courseId);
    }
  });
};

export const deleteAttendanceRecord = (recordId: string) => {
  console.log(`[DB] Deleting attendance record: ${recordId}`);
  const record = db.getFirstSync<AttendanceRecord>('SELECT * FROM attendance_records WHERE id = ?', recordId);
  if (!record) {
    console.log(`[DB] Attendance record not found: ${recordId}`);
    return;
  }

  db.withTransactionSync(() => {
    db.runSync('DELETE FROM attendance_records WHERE id = ?', recordId);

    let updateColumn = '';
    if (record.status === 'present') {
      updateColumn = 'presents';
    } else if (record.status === 'absent') {
      updateColumn = 'absents';
    } else if (record.status === 'cancelled') {
      updateColumn = 'cancelled';
    }

    if (updateColumn) {
      db.runSync(`UPDATE courses SET ${updateColumn} = ${updateColumn} - 1 WHERE id = ?`, record.course_id);
    }
  });
};

export const deleteCourse = (courseId: string) => {
  console.log(`[DB] Deleting course: ${courseId}`);
  db.runSync('DELETE FROM courses WHERE id = ?', courseId);
};

export const addAttendanceRecord = (record: AttendanceRecord) => {
  console.log(`[DB] Adding attendance record for course: ${record.course_id}`);
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT INTO attendance_records (id, course_id, class_date, status, is_extra_class, schedule_item_id, time_start, time_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      record.id, record.course_id, record.date, record.status, record.isExtraClass ? 1 : 0, record.scheduleItemId || null, record.timeStart, record.timeEnd
    );

    let updateColumn = '';
    if (record.status === 'present') {
      updateColumn = 'presents';
    } else if (record.status === 'absent') {
      updateColumn = 'absents';
    } else if (record.status === 'cancelled') {
      updateColumn = 'cancelled';
    }

    if (updateColumn) {
      db.runSync(`UPDATE courses SET ${updateColumn} = ${updateColumn} + 1 WHERE id = ?`, record.course_id);
    }
  });
};

export const bulkAddAttendanceRecords = (records: AttendanceRecord[]) => {
  if (records.length === 0) return;
  console.log(`Bulk adding ${records.length} attendance records`);
  db.withTransactionSync(() => {
    const statement = db.prepareSync('INSERT INTO attendance_records (id, course_id, class_date, status, is_extra_class, schedule_item_id, time_start, time_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const record of records) {
      statement.executeSync(record.id, record.course_id, record.date, record.status, record.isExtraClass ? 1 : 0, record.scheduleItemId || null, record.timeStart, record.timeEnd);
    }
    statement.finalizeSync();
  });
};

export const getAttendanceRecords = (
  limit: number,
  offset: number,
  courseIds?: string[],
  startDate?: string,
  endDate?: string
): AttendanceRecord[] => {
  let query = 'SELECT * FROM attendance_records';
  const params: any[] = [];

  if ((courseIds && courseIds.length > 0) || startDate || endDate) {
    query += ' WHERE';
    let conditions: string[] = [];
    if (courseIds && courseIds.length > 0) {
      conditions.push(`course_id IN (${courseIds.map(() => '?').join(',')})`);
      params.push(...courseIds);
    }
    if (startDate) {
      conditions.push('class_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('class_date <= ?');
      params.push(endDate);
    }
    query += ' ' + conditions.join(' AND ');
  }

  if (limit == -1) {
    query += ' ORDER BY class_date DESC, time_start DESC';
  } else {
    query += ' ORDER BY class_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  return db.getAllSync(query, ...params).map((r: any) => ({
    id: r.id,
    course_id: r.course_id,
    date: r.class_date,
    status: r.status,
    isExtraClass: r.is_extra_class === 1,
    scheduleItemId: r.schedule_item_id,
    timeStart: r.time_start,
    timeEnd: r.time_end,
  }));
};

export const getAttendanceRecordsCount = (
  courseIds?: string[],
  startDate?: string,
  endDate?: string
): number => {
  let query = 'SELECT COUNT(*) as count FROM attendance_records';
  const params: any[] = [];

  if ((courseIds && courseIds.length > 0) || startDate || endDate) {
    query += ' WHERE';
    let conditions: string[] = [];
    if (courseIds && courseIds.length > 0) {
      conditions.push(`course_id IN (${courseIds.map(() => '?').join(',')})`);
      params.push(...courseIds);
    }
    if (startDate) {
      conditions.push('class_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('class_date <= ?');
      params.push(endDate);
    }
    query += ' ' + conditions.join(' AND ');
  }

  const result = db.getFirstSync<{ count: number }>(query, ...params);
  return result ? result.count : 0;
};

export const bulkUpdateCourseCounts = (courseCounts: { [courseId: string]: { presents: number, absents: number, cancelled: number } }) => {
  if (Object.keys(courseCounts).length === 0) return;
  console.log(`Bulk updating counts for ${Object.keys(courseCounts).length} courses`);
  db.withTransactionSync(() => {
    const statement = db.prepareSync('UPDATE courses SET presents = presents + ?, absents = absents + ?, cancelled = cancelled + ? WHERE id = ?');
    for (const courseId in courseCounts) {
      const counts = courseCounts[courseId];
      statement.executeSync(counts.presents, counts.absents, counts.cancelled, courseId);
    }
    statement.finalizeSync();
  });
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

export const deleteExtraClass = (courseId: string, extraClassId: string) => {
  console.log(`[DB] Deleting extra class: ${extraClassId} from course: ${courseId}`);
  db.runSync('DELETE FROM extra_classes WHERE id = ? AND course_id = ?', extraClassId, courseId);
};

export const archiveCourse = (courseId: string) => {
  console.log(`[DB] Archiving course: ${courseId}`);
  db.runSync('UPDATE courses SET is_archived = 1, archived_at = ? WHERE id = ?', formatDateToISO(new Date()), courseId);
};

export const unarchiveCourse = (courseId: string) => {
  console.log(`[DB] Unarchiving course: ${courseId}`);
  db.runSync('UPDATE courses SET is_archived = 0, archived_at = NULL WHERE id = ?', courseId);
};

export const clearCourseColors = () => {
  console.log('Clearing course colors');
  db.runSync('UPDATE courses SET color = NULL');
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
  db.runSync("INSERT INTO app_settings (key, value) VALUES ('defaultAttendanceStatus', 'absent')");
};
