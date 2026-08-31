import * as SQLite from 'expo-sqlite';
import { AttendanceCounts, AttendanceRecord, AttendanceStatus, Course, ExtraClass, Holiday, SkipDay } from '../types';
import { formatDateToISO } from './dateHelpers';
import { getAttendanceCountField } from './attendanceStatus';

const DATABASE_NAME = 'grad.db';
const SCHEMA_VERSION = 3;
const DEFAULT_SETTINGS = [
  ['theme', 'light'],
  ['notificationTime', '10'],
  ['notificationsEnabled', 'false'],
  ['is24Hour', 'false'],
  ['defaultAttendanceStatus', 'absent'],
  ['holidayBehavior', 'skip'],
  ['backupRemindersEnabled', 'false'],
  ['lastBackupAt', ''],
] as const;

const openDatabase = () => {
  const database = SQLite.openDatabaseSync(DATABASE_NAME);
  database.execSync('PRAGMA foreign_keys = ON');
  return database;
};

export let db = openDatabase();

const adjustCourseAttendanceCount = (
  courseId: string,
  status: AttendanceStatus,
  amount: 1 | -1,
): void => {
  const field = getAttendanceCountField(status);
  if (!field) return;
  db.runSync(`UPDATE courses SET ${field} = MAX(0, ${field} + ?) WHERE id = ?`, amount, courseId);
};

const mapAttendanceRecord = (row: any): AttendanceRecord => ({
  id: row.id,
  course_id: row.course_id,
  date: row.class_date,
  status: row.status,
  isExtraClass: row.is_extra_class === 1,
  scheduleItemId: row.schedule_item_id || undefined,
  timeStart: row.time_start,
  timeEnd: row.time_end,
});

interface AttendanceUpsertResult {
  record: AttendanceRecord;
  previousStatus: AttendanceStatus | null;
  changed: boolean;
}

export const reopenDatabase = () => {
  db = openDatabase();
};

export const initDatabase = () => {
  console.log('Initializing database...');
  db.withTransactionSync(() => {
    const schemaVersion = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;

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
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'cancelled', 'holiday', 'skipped')),
      is_extra_class BOOLEAN NOT NULL,
      schedule_item_id TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS skip_days (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      end_date TEXT,
      course_id TEXT,
      reason TEXT,
      time_start TEXT,
      time_end TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
    `);

    const skipDayColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(skip_days)');
    const skipDayColumnNames = skipDayColumns.map(c => c.name);

    if (!skipDayColumnNames.includes('end_date')) {
      console.log('Migrating database: adding end_date column to skip_days');
      db.execSync('ALTER TABLE skip_days ADD COLUMN end_date TEXT');
    }
    if (!skipDayColumnNames.includes('time_start')) {
      console.log('Migrating database: adding time_start column to skip_days');
      db.execSync('ALTER TABLE skip_days ADD COLUMN time_start TEXT');
    }
    if (!skipDayColumnNames.includes('time_end')) {
      console.log('Migrating database: adding time_end column to skip_days');
      db.execSync('ALTER TABLE skip_days ADD COLUMN time_end TEXT');
    }

    if (schemaVersion < SCHEMA_VERSION) {
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
    }

    if (schemaVersion < 2) {
      console.log('Migrating database: removing duplicate attendance and orphaned course data');

      db.execSync(`
        DELETE FROM attendance_records
        WHERE NOT EXISTS (
          SELECT 1 FROM courses c WHERE c.id = attendance_records.course_id
        );
        DELETE FROM extra_classes
        WHERE NOT EXISTS (
          SELECT 1 FROM courses c WHERE c.id = extra_classes.course_id
        );
        DELETE FROM weekly_schedules
        WHERE NOT EXISTS (
          SELECT 1 FROM courses c WHERE c.id = weekly_schedules.course_id
        );
        DELETE FROM skip_days
        WHERE course_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM courses c WHERE c.id = skip_days.course_id
          );

        CREATE TEMP TABLE attendance_duplicates_to_delete AS
        SELECT id
        FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY course_id, class_date, time_start, time_end, is_extra_class
                   ORDER BY rowid
                 ) AS occurrence_number
          FROM attendance_records
        )
        WHERE occurrence_number > 1;

        DELETE FROM attendance_records
        WHERE id IN (SELECT id FROM attendance_duplicates_to_delete);
        DROP TABLE attendance_duplicates_to_delete;

        UPDATE courses
        SET presents = (
              SELECT COUNT(*) FROM attendance_records ar
              WHERE ar.course_id = courses.id AND ar.status = 'present'
            ),
            absents = (
              SELECT COUNT(*) FROM attendance_records ar
              WHERE ar.course_id = courses.id AND ar.status = 'absent'
            ),
            cancelled = (
              SELECT COUNT(*) FROM attendance_records ar
              WHERE ar.course_id = courses.id AND ar.status = 'cancelled'
            );
      `);
    }

    if (schemaVersion < 3) {
      // SQLite cannot alter a CHECK constraint in place. Rebuild the table so
      // informational holiday and skipped statuses can be stored in history.
      db.execSync(`
        CREATE TABLE attendance_records_new (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          class_date TEXT NOT NULL,
          time_start TEXT NOT NULL,
          time_end TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'cancelled', 'holiday', 'skipped')),
          is_extra_class BOOLEAN NOT NULL,
          schedule_item_id TEXT,
          FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        );
        INSERT INTO attendance_records_new
          (id, course_id, class_date, time_start, time_end, status, is_extra_class, schedule_item_id)
        SELECT id, course_id, class_date, time_start, time_end, status, is_extra_class, schedule_item_id
        FROM attendance_records;
        DROP TABLE attendance_records;
        ALTER TABLE attendance_records_new RENAME TO attendance_records;
      `);
    }

    db.execSync(`
      CREATE INDEX IF NOT EXISTS weekly_schedules_course_id ON weekly_schedules(course_id);
      CREATE INDEX IF NOT EXISTS extra_classes_course_id_date ON extra_classes(course_id, date);
      CREATE INDEX IF NOT EXISTS attendance_records_course_id_date_time ON attendance_records(course_id, class_date, time_start);
      CREATE INDEX IF NOT EXISTS attendance_records_date_time_end ON attendance_records(class_date DESC, time_end DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_occurrence_unique
        ON attendance_records(course_id, class_date, time_start, time_end, is_extra_class);
      CREATE INDEX IF NOT EXISTS skip_days_course_id ON skip_days(course_id);
    `);
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });

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
    .map(mapAttendanceRecord);

  const presents = Math.max(0, Number.isFinite(c.presents) ? c.presents : 0);
  const absents = Math.max(0, Number.isFinite(c.absents) ? c.absents : 0);
  const cancelled = Math.max(0, Number.isFinite(c.cancelled) ? c.cancelled : 0);
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
      'UPDATE courses SET name = ?, required_attendance = ?, presents = ?, absents = ?, cancelled = ?, color = ?, show_in_tracker = ?, show_in_heatmap = ?, show_in_radar = ?, created_at = COALESCE(?, created_at) WHERE id = ?',
      course.name, course.requiredAttendance, course.presents, course.absents, course.cancelled, course.color || null, course.showInTracker ? 1 : 0, course.showInHeatmap ? 1 : 0, course.showInRadar ? 1 : 0, course.createdAt || null, course.id
    );

    if (course.weeklySchedule) {
      const existingScheduleIds = db.getAllSync<{ id: string }>('SELECT id FROM weekly_schedules WHERE course_id = ?', course.id).map(s => s.id);
      const newScheduleIds = course.weeklySchedule.map(s => s.id);
      const schedulesToDelete = existingScheduleIds.filter(id => !newScheduleIds.includes(id));
      if (schedulesToDelete.length > 0) {
        db.runSync(`DELETE FROM weekly_schedules WHERE id IN (${schedulesToDelete.map(() => '?').join(',')})`, ...schedulesToDelete);
      }
      course.weeklySchedule.forEach(item => {
        db.runSync(
          'INSERT OR REPLACE INTO weekly_schedules (id, course_id, day, time_start, time_end) VALUES (?, ?, ?, ?, ?)',
          item.id, course.id, item.day, item.timeStart, item.timeEnd
        );
      });
    }

    if (course.extraClasses) {
      const existingExtraClassIds = db.getAllSync<{ id: string }>('SELECT id FROM extra_classes WHERE course_id = ?', course.id).map(e => e.id);
      const newExtraClassIds = course.extraClasses.map(e => e.id);
      const extraClassesToDelete = existingExtraClassIds.filter(id => !newExtraClassIds.includes(id));
      if (extraClassesToDelete.length > 0) {
        db.runSync(`DELETE FROM extra_classes WHERE id IN (${extraClassesToDelete.map(() => '?').join(',')})`, ...extraClassesToDelete);
      }
      course.extraClasses.forEach(item => {
        db.runSync(
          'INSERT OR REPLACE INTO extra_classes (id, course_id, date, time_start, time_end) VALUES (?, ?, ?, ?, ?)',
          item.id, course.id, item.date, item.timeStart, item.timeEnd
        );
      });
    }

  });
};

export const deleteCourse = (courseId: string) => {
  console.log(`[DB] Deleting course: ${courseId}`);
  db.runSync('DELETE FROM courses WHERE id = ?', courseId);
};

export const upsertAttendanceRecord = (record: AttendanceRecord): AttendanceUpsertResult => {
  console.log(`[DB] Upserting attendance for ${record.course_id} on ${record.date} at ${record.timeStart}`);
  let result: AttendanceUpsertResult | undefined;

  db.withTransactionSync(() => {
    const row = db.getFirstSync<any>(
      `SELECT * FROM attendance_records
       WHERE course_id = ? AND class_date = ? AND time_start = ? AND time_end = ? AND is_extra_class = ?`,
      record.course_id,
      record.date,
      record.timeStart,
      record.timeEnd,
      record.isExtraClass ? 1 : 0,
    );

    if (row) {
      const existingRecord = mapAttendanceRecord(row);
      if (existingRecord.status === record.status) {
        result = { record: existingRecord, previousStatus: existingRecord.status, changed: false };
        return;
      }

      db.runSync(
        'UPDATE attendance_records SET status = ?, schedule_item_id = ? WHERE id = ?',
        record.status,
        record.scheduleItemId || null,
        existingRecord.id,
      );
      adjustCourseAttendanceCount(existingRecord.course_id, existingRecord.status, -1);
      adjustCourseAttendanceCount(existingRecord.course_id, record.status, 1);
      result = {
        record: { ...existingRecord, status: record.status, scheduleItemId: record.scheduleItemId },
        previousStatus: existingRecord.status,
        changed: true,
      };
      return;
    }

    db.runSync(
      'INSERT INTO attendance_records (id, course_id, class_date, status, is_extra_class, schedule_item_id, time_start, time_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      record.id,
      record.course_id,
      record.date,
      record.status,
      record.isExtraClass ? 1 : 0,
      record.scheduleItemId || null,
      record.timeStart,
      record.timeEnd,
    );
    adjustCourseAttendanceCount(record.course_id, record.status, 1);
    result = { record, previousStatus: null, changed: true };
  });

  return result!;
};

export const deleteAttendanceOccurrence = (
  courseId: string,
  date: string,
  timeStart: string,
  timeEnd: string,
  isExtraClass: boolean,
): AttendanceRecord | null => {
  console.log(`[DB] Deleting attendance for ${courseId} on ${date} at ${timeStart}`);
  let deletedRecord: AttendanceRecord | null = null;

  db.withTransactionSync(() => {
    const row = db.getFirstSync<any>(
      `SELECT * FROM attendance_records
       WHERE course_id = ? AND class_date = ? AND time_start = ? AND time_end = ? AND is_extra_class = ?`,
      courseId,
      date,
      timeStart,
      timeEnd,
      isExtraClass ? 1 : 0,
    );
    if (!row) return;

    deletedRecord = mapAttendanceRecord(row);
    db.runSync('DELETE FROM attendance_records WHERE id = ?', deletedRecord.id);
    adjustCourseAttendanceCount(deletedRecord.course_id, deletedRecord.status, -1);
  });

  return deletedRecord;
};

export const bulkAddAttendanceRecords = (
  records: AttendanceRecord[],
) => {
  if (records.length === 0) return;
  console.log(`Bulk adding ${records.length} attendance records`);
  const courseCounts: Record<string, AttendanceCounts> = {};
  for (const record of records) {
    const counts = courseCounts[record.course_id] ?? (courseCounts[record.course_id] = {
      presents: 0,
      absents: 0,
      cancelled: 0,
    });
    const field = getAttendanceCountField(record.status);
    if (field) counts[field] += 1;
  }

  db.withTransactionSync(() => {
    const statement = db.prepareSync('INSERT INTO attendance_records (id, course_id, class_date, status, is_extra_class, schedule_item_id, time_start, time_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    try {
      for (const record of records) {
        statement.executeSync(record.id, record.course_id, record.date, record.status, record.isExtraClass ? 1 : 0, record.scheduleItemId || null, record.timeStart, record.timeEnd);
      }
    } finally {
      statement.finalizeSync();
    }
    const countStatement = db.prepareSync('UPDATE courses SET presents = presents + ?, absents = absents + ?, cancelled = cancelled + ? WHERE id = ?');
    try {
      for (const courseId in courseCounts) {
        const counts = courseCounts[courseId];
        countStatement.executeSync(counts.presents, counts.absents, counts.cancelled, courseId);
      }
    } finally {
      countStatement.finalizeSync();
    }
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
  const conditions: string[] = [];

  if (courseIds && courseIds.length > 0) {
    conditions.push(`course_id IN (${courseIds.map(() => '?').join(',')})`);
    params.push(...courseIds);
  }
  if (startDate) {
    conditions.push('class_date >= ?');
    params.push(startDate);
  }
  // Always filter for past records if no specific endDate is provided
  const effectiveEndDate = endDate || formatDateToISO(new Date());
  conditions.push('class_date <= ?');
  params.push(effectiveEndDate);

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  if (limit === -1) {
    query += ' ORDER BY class_date DESC, time_end DESC';
  } else {
    query += ' ORDER BY class_date DESC, time_end DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  return db.getAllSync(query, ...params).map(mapAttendanceRecord);
};

export const getAttendanceRecordsCount = (
  courseIds?: string[],
  startDate?: string,
  endDate?: string
): number => {
  let query = 'SELECT COUNT(*) as count FROM attendance_records';
  const params: any[] = [];
  const conditions: string[] = [];

  if (courseIds && courseIds.length > 0) {
    conditions.push(`course_id IN (${courseIds.map(() => '?').join(',')})`);
    params.push(...courseIds);
  }
  if (startDate) {
    conditions.push('class_date >= ?');
    params.push(startDate);
  }
  // Always filter for past records if no specific endDate is provided
  const effectiveEndDate = endDate || formatDateToISO(new Date());
  conditions.push('class_date <= ?');
  params.push(effectiveEndDate);

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  const result = db.getFirstSync<{ count: number }>(query, ...params);
  return result ? result.count : 0;
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
    db.execSync(`
      DELETE FROM attendance_records;
      DELETE FROM extra_classes;
      DELETE FROM weekly_schedules;
      DELETE FROM skip_days;
      DELETE FROM courses;
      DELETE FROM holidays;
      DELETE FROM app_settings;
    `);
    const statement = db.prepareSync('INSERT INTO app_settings (key, value) VALUES (?, ?)');
    try {
      for (const [key, value] of DEFAULT_SETTINGS) {
        statement.executeSync(key, value);
      }
    } finally {
      statement.finalizeSync();
    }
  });
};

export const getHolidays = (): Holiday[] => {
  console.log('Getting all holidays');
  const holidaysFromDb = db.getAllSync<any>('SELECT * FROM holidays ORDER BY start_date ASC');
  return holidaysFromDb.map((h: any) => ({
    id: h.id,
    name: h.name,
    startDate: h.start_date,
    endDate: h.end_date,
  }));
};

export const addHoliday = (holiday: Holiday) => {
  console.log(`Adding holiday: ${holiday.name}`);
  db.runSync(
    'INSERT INTO holidays (id, name, start_date, end_date) VALUES (?, ?, ?, ?)',
    holiday.id, holiday.name, holiday.startDate, holiday.endDate
  );
};

export const deleteHoliday = (holidayId: string) => {
  console.log(`[DB] Deleting holiday: ${holidayId}`);
  db.runSync('DELETE FROM holidays WHERE id = ?', holidayId);
};

// Skip Days CRUD
export const getSkipDays = (): SkipDay[] => {
  console.log('Getting all skip days');
  const skipDaysFromDb = db.getAllSync<any>('SELECT * FROM skip_days ORDER BY date ASC');
  return skipDaysFromDb.map((s: any) => ({
    id: s.id,
    date: s.date,
    endDate: s.end_date || s.date,
    courseId: s.course_id || undefined,
    reason: s.reason || undefined,
    timeStart: s.time_start || undefined,
    timeEnd: s.time_end || undefined,
  }));
};

export const addSkipDay = (skipDay: SkipDay) => {
  console.log(`Adding skip day: ${skipDay.date}`);
  db.runSync(
    'INSERT INTO skip_days (id, date, end_date, course_id, reason, time_start, time_end) VALUES (?, ?, ?, ?, ?, ?, ?)',
    skipDay.id,
    skipDay.date,
    skipDay.endDate || skipDay.date,
    skipDay.courseId || null,
    skipDay.reason || null,
    skipDay.timeStart || null,
    skipDay.timeEnd || null
  );
};

export const deleteSkipDay = (skipDayId: string) => {
  console.log(`[DB] Deleting skip day: ${skipDayId}`);
  db.runSync('DELETE FROM skip_days WHERE id = ?', skipDayId);
};
