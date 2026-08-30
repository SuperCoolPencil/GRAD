import { AttendanceCounts, AttendanceRecord, AttendanceStatus, Course, Holiday, SkipDay } from '@/types';
import { db, getSetting, bulkAddAttendanceRecords, getCourses } from './database';
import { formatDateToISO, parseISOToDate } from './dateHelpers';
import {
  addAttendanceStatusToCounts,
  decideAutomaticAttendance,
  emptyAttendanceCounts,
  getDefaultAttendanceStatus,
} from './attendanceStatus';

/**
 * Returns classes to attend (positive), classes that can be missed (negative),
 * or zero when the target is already met exactly.
 */
export const getAttendanceDelta = (
  presents: number,
  absents: number,
  requiredAttendance: number,
  plannedAbsences = 0,
): number => {
  const safePresents = Math.max(0, Number.isFinite(presents) ? presents : 0);
  const safeAbsents = Math.max(0, Number.isFinite(absents) ? absents : 0);
  const safePlannedAbsences = Math.max(0, Number.isFinite(plannedAbsences) ? plannedAbsences : 0);
  const total = safePresents + safeAbsents + safePlannedAbsences;
  const requiredFraction = Math.min(1, Math.max(0, Number.isFinite(requiredAttendance) ? requiredAttendance / 100 : 0.75));

  if (total === 0 || requiredFraction <= 0) return 0;
  if (requiredFraction === 1) {
    return safePresents === total ? 0 : Number.POSITIVE_INFINITY;
  }

  // The epsilon prevents exact boundaries such as 75% from flipping because of
  // binary floating-point representation.
  const epsilon = 1e-10;
  if (safePresents / total >= requiredFraction) {
    const missable = Math.floor(safePresents / requiredFraction - total + epsilon);
    return missable > 0 ? -missable : 0;
  }
  return Math.ceil((requiredFraction * total - safePresents) / (1 - requiredFraction) - epsilon);
};

/**
 * Helper to check if a specific class session on a given date is matched by any skip day.
 */
export const isClassSkippedBySkipDay = (
  dateString: string,
  courseId: string,
  timeStart: string | undefined,
  timeEnd: string | undefined,
  skipDays: SkipDay[],
): boolean => {
  return skipDays.some((s) => {
    if (s.courseId && s.courseId !== courseId) return false;
    const startDate = s.date;
    const endDate = s.endDate || s.date;
    if (dateString < startDate || dateString > endDate) return false;
    if (s.timeStart && s.timeEnd && timeStart && timeEnd) {
      if (timeStart < s.timeStart || timeEnd > s.timeEnd) return false;
    }
    return true;
  });
};

/**
 * Counts future classes that have already been planned as absences via skip days.
 * Holidays always win: a class that will not happen cannot be an absence.
 * Supports date ranges (startDate to endDate) and optional time bounds (timeStart to timeEnd).
 */
export const getPlannedSkipDayAbsences = (
  course: Course,
  holidays: Holiday[],
  skipDays: SkipDay[],
  now = new Date(),
): number => {
  const firstFutureDate = new Date(now);
  firstFutureDate.setDate(firstFutureDate.getDate() + 1);
  const firstFutureISO = formatDateToISO(firstFutureDate);

  const holidayDates = new Set<string>();
  for (const holiday of holidays) {
    const date = parseISOToDate(holiday.startDate);
    const endDate = parseISOToDate(holiday.endDate);
    while (date <= endDate) {
      holidayDates.add(formatDateToISO(date));
      date.setDate(date.getDate() + 1);
    }
  }

  let totalAbsences = 0;
  const countedClasses = new Set<string>();

  for (const skipDay of skipDays) {
    if (skipDay.courseId && skipDay.courseId !== course.id) continue;

    const startDateStr = skipDay.date;
    const endDateStr = skipDay.endDate || skipDay.date;

    if (endDateStr < firstFutureISO) continue;

    let current = parseISOToDate(startDateStr);
    const end = parseISOToDate(endDateStr);

    while (current <= end) {
      const dateString = formatDateToISO(current);
      if (dateString >= firstFutureISO && !holidayDates.has(dateString)) {
        const dayOfWeek = getDayOfWeek(current);

        // Check weekly schedule classes
        course.weeklySchedule?.forEach((schedule) => {
          if (schedule.day.toLowerCase() === dayOfWeek) {
            const timeMatch = !skipDay.timeStart || !skipDay.timeEnd ||
              (schedule.timeStart >= skipDay.timeStart && schedule.timeEnd <= skipDay.timeEnd);
            if (timeMatch) {
              const classKey = `${dateString}:${schedule.id}:${schedule.timeStart}`;
              if (!countedClasses.has(classKey)) {
                countedClasses.add(classKey);
                totalAbsences++;
              }
            }
          }
        });

        // Check extra classes
        course.extraClasses?.forEach((extraClass) => {
          if (extraClass.date === dateString) {
            const timeMatch = !skipDay.timeStart || !skipDay.timeEnd ||
              (extraClass.timeStart >= skipDay.timeStart && extraClass.timeEnd <= skipDay.timeEnd);
            if (timeMatch) {
              const classKey = `${dateString}:extra:${extraClass.id}:${extraClass.timeStart}`;
              if (!countedClasses.has(classKey)) {
                countedClasses.add(classKey);
                totalAbsences++;
              }
            }
          }
        });
      }
      current.setDate(current.getDate() + 1);
    }
  }

  return totalAbsences;
};

/** The calendar-aware attendance delta used anywhere the app shows “bunk” or “attend”. */
export const getCourseAttendanceDelta = (
  course: Course,
  holidays: Holiday[],
  skipDays: SkipDay[],
  now?: Date,
): number => getAttendanceDelta(
  course.presents || 0,
  course.absents || 0,
  course.requiredAttendance ?? 75,
  getPlannedSkipDayAbsences(course, holidays, skipDays, now),
);

export interface BunkSimulationResult {
  currentPercentage: number;
  simulatedPercentage: number;
  currentDelta: number;
  simulatedDelta: number;
  isSafe: boolean;
  message: string;
  targetDate: Date | null;
  targetMessage: string;
}

export interface BunkedClass {
  date: string;
  courseId: string;
  timeStart: string;
  timeEnd: string;
}

/**
 * Simulates the effect of skipping an additional class for a given course.
 * currentPercentage = actual attendance so far (matches card display)
 * simulatedPercentage = projected attendance after bunking this class
 *   (accounts for already-planned skip days too)
 */
export const simulateBunkClass = (
  course: Course,
  holidays: Holiday[],
  skipDays: SkipDay[],
  additionalAbsences: number = 1,
  bunkedClass?: BunkedClass,
  includeTargetDate = true,
): BunkSimulationResult => {
  const presents = Math.max(0, Number.isFinite(course.presents) ? course.presents : 0);
  const absents = Math.max(0, Number.isFinite(course.absents) ? course.absents : 0);
  const required = Number.isFinite(course.requiredAttendance) ? course.requiredAttendance : 75;
  const todayISO = formatDateToISO(new Date());
  const isFutureBunk = bunkedClass?.date && bunkedClass.date > todayISO;
  const simulatedSkipDays = isFutureBunk && bunkedClass
    ? [...skipDays, {
      id: '__bunk-simulation__',
      date: bunkedClass.date,
      endDate: bunkedClass.date,
      courseId: bunkedClass.courseId,
      timeStart: bunkedClass.timeStart,
      timeEnd: bunkedClass.timeEnd,
    }]
    : skipDays;
  const plannedSkip = getPlannedSkipDayAbsences(course, holidays, skipDays);
  const simulatedPlannedSkip = getPlannedSkipDayAbsences(course, holidays, simulatedSkipDays);
  const immediateAbsences = isFutureBunk ? 0 : additionalAbsences;

  // Effective % = actual + planned future absences already committed to.
  // This is the "where you're headed" rate, not raw historical attendance.
  // The card shows raw (presents/total); the sim shows the projection.
  const effectiveTotal = presents + absents + plannedSkip;
  const currentPercentage = effectiveTotal > 0 ? Math.round((presents / effectiveTotal) * 100) : 100;
  const currentDelta = getAttendanceDelta(presents, absents, required, plannedSkip);

  // Future bunks add a planned absence; past/today bunks add an immediate absence.
  const totalSimulated = presents + absents + immediateAbsences + simulatedPlannedSkip;
  const simulatedPercentage = totalSimulated > 0 ? Math.round((presents / totalSimulated) * 100) : 100;
  const simulatedDelta = getAttendanceDelta(presents, absents + immediateAbsences, required, simulatedPlannedSkip);
  const target = includeTargetDate
    ? calculateTargetDate(
        { ...course, absents: absents + immediateAbsences },
        holidays,
        simulatedSkipDays,
      )
    : null;

  const isSafe = simulatedDelta <= 0;

  let message = '';
  if (isSafe) {
    if (simulatedDelta < 0) {
      const remainingBunks = Math.abs(simulatedDelta);
      message = `Still safe! You can miss ${remainingBunks} more class${remainingBunks === 1 ? '' : 'es'} after this.`;
    } else {
      message = `On target! Bunking this brings you right to your limit.`;
    }
  } else if (!Number.isFinite(simulatedDelta)) {
    message = 'A 100% target cannot be recovered after an absence.';
  } else {
    message = `Careful! You will need to attend ${simulatedDelta} class${simulatedDelta === 1 ? '' : 'es'} to recover.`;
  }

  return {
    currentPercentage,
    simulatedPercentage,
    currentDelta,
    simulatedDelta,
    isSafe,
    message,
    targetDate: target?.targetDate ?? null,
    targetMessage: target?.message ?? '',
  };
};

const getDayOfWeek = (date: Date): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

const addAutomaticAttendanceRecord = ({
  course,
  record,
  isHoliday,
  isSkipDay,
  defaultStatus,
  newRecords,
  courseCounts,
}: {
  course: Pick<Course, 'id' | 'name'>;
  record: AttendanceRecord;
  isHoliday: boolean;
  isSkipDay: boolean;
  defaultStatus: AttendanceStatus;
  newRecords: AttendanceRecord[];
  courseCounts: Record<string, AttendanceCounts>;
}): void => {
  const decision = decideAutomaticAttendance({ isHoliday, isSkipDay, defaultStatus });

  if (decision.action === 'skip') {
    console.log(`[ATTEND] Skipping ${record.isExtraClass ? 'extra ' : ''}class for ${course.name} on ${record.date} (holiday)`);
    return;
  }

  newRecords.push({ ...record, status: decision.status });
  const counts = courseCounts[course.id] ?? (courseCounts[course.id] = emptyAttendanceCounts());
  addAttendanceStatusToCounts(counts, decision.status);

  const kind = record.isExtraClass ? ' extra-class' : '';
  const source = decision.reason === 'skip-day' ? ' (skip day)' : '';
  console.log(`[ATTEND] Created ${decision.status.toUpperCase()}${kind} record for ${course.name} on ${record.date} at ${record.timeStart}${source}`);
};

const processWeeklySchedule = (
  course: any,
  lastRecordDate: Date,
  endDate: Date,
  now: Date,
  existingRecordIds: Set<unknown>,
  newRecords: AttendanceRecord[],
  courseCounts: Record<string, AttendanceCounts>,
  defaultStatus: AttendanceStatus,
  holidaySet?: Set<string>, // optional set of 'YYYY-MM-DD' strings
  isSkipDay?: (dateString: string, courseId: string, timeStart: string, timeEnd: string) => boolean
) => {
  if (!course.weeklySchedule || course.weeklySchedule.length === 0) return;

  let currentDate = new Date(lastRecordDate);
  while (currentDate <= endDate) {
    const dayOfWeek = getDayOfWeek(currentDate);
    for (const schedule of course.weeklySchedule) {
      if (schedule.day.toLowerCase() === dayOfWeek) {
        const [hours, minutes] = schedule.timeEnd.split(':').map(Number);
        const classDateTime = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          hours,
          minutes
        );

        if (classDateTime > lastRecordDate && classDateTime <= now) {
          const dateString = formatDateToISO(currentDate);
          const attendanceId = `${course.id}-${schedule.id}-${dateString}`;

          // check local existing ids first
          let exists = existingRecordIds.has(attendanceId);

          // also check DB for a record with same course/date/timeStart to avoid duplicates
          if (!exists) {
            const dbExisting = db.getFirstSync(
              'SELECT id FROM attendance_records WHERE course_id = ? AND class_date = ? AND time_start = ?',
              course.id,
              dateString,
              schedule.timeStart
            );
            exists = !!dbExisting;
          }

          if (exists) continue;

          const isHoliday = holidaySet
            ? holidaySet.has(dateString)
            : !!db.getFirstSync('SELECT id, name FROM holidays WHERE start_date <= ? AND end_date >= ? LIMIT 1', dateString, dateString);
          addAutomaticAttendanceRecord({
            course,
            isHoliday,
            isSkipDay: isSkipDay?.(dateString, course.id, schedule.timeStart, schedule.timeEnd) ?? false,
            defaultStatus,
            newRecords,
            courseCounts,
            record: {
            id: attendanceId,
            course_id: course.id,
            date: dateString,
            status: defaultStatus,
            isExtraClass: false,
            scheduleItemId: schedule.id,
            timeStart: schedule.timeStart,
            timeEnd: schedule.timeEnd,
            },
          });
        }
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
};

const processExtraClasses = (
  course: any,
  lastRecordDate: Date,
  endDate: Date,
  existingRecordIds: Set<unknown>,
  newRecords: AttendanceRecord[],
  courseCounts: Record<string, AttendanceCounts>,
  defaultStatus: AttendanceStatus,
  holidaySet?: Set<string>, // optional set of 'YYYY-MM-DD' strings
  isSkipDay?: (dateString: string, courseId: string, timeStart: string, timeEnd: string) => boolean
) => {
  if (!course.extraClasses || course.extraClasses.length === 0) return;

  for (const extraClass of course.extraClasses) {
    if (extraClass.date && extraClass.timeEnd) {
      const [year, month, day] = extraClass.date.split('-').map(Number);
      const [hour, minute] = extraClass.timeEnd.split(':').map(Number);
      const extraClassDateTime = new Date(year, month - 1, day, hour, minute);

      if (extraClassDateTime > lastRecordDate && extraClassDateTime <= endDate) {
        const attendanceId = `${course.id}-${extraClass.id}-${extraClass.date}`;

        // check local existing ids first
        let exists = existingRecordIds.has(attendanceId);

        // also safe-check DB
        if (!exists) {
          const dbExisting = db.getFirstSync(
            'SELECT id FROM attendance_records WHERE course_id = ? AND class_date = ? AND time_start = ?',
            course.id,
            extraClass.date,
            extraClass.timeStart
          );
          exists = !!dbExisting;
        }

        if (exists) continue;

        const isHoliday = holidaySet
          ? holidaySet.has(extraClass.date)
          : !!db.getFirstSync('SELECT id, name FROM holidays WHERE start_date <= ? AND end_date >= ? LIMIT 1', extraClass.date, extraClass.date);
        addAutomaticAttendanceRecord({
          course,
          isHoliday,
          isSkipDay: isSkipDay?.(extraClass.date, course.id, extraClass.timeStart, extraClass.timeEnd) ?? false,
          defaultStatus,
          newRecords,
          courseCounts,
          record: {
            id: attendanceId,
            course_id: course.id,
            date: extraClass.date,
            status: defaultStatus,
            isExtraClass: true,
            scheduleItemId: extraClass.id,
            timeStart: extraClass.timeStart,
            timeEnd: extraClass.timeEnd,
          },
        });
      }
    }
  }
};

export const createMissingAttendanceRecords = (): boolean => {
  if (!db) throw new Error('DB not initialized');
  console.log('[ATTEND] Starting to create missing attendance records (holidays supported)...');

  const now = new Date();
  const courses = getCourses();
  console.log(`[ATTEND] Found ${courses.length} courses to process.`);

  const defaultStatus = getDefaultAttendanceStatus(getSetting('defaultAttendanceStatus'));

  // --- build holidaySet (YYYY-MM-DD) by expanding holiday ranges ----------
  const holidaySet = new Set<string>();
  const holidaysFromDb = db.getAllSync<{ start_date: string; end_date: string }>('SELECT start_date, end_date FROM holidays');
  const normalizeDateOnly = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const addDays = (d: Date, days: number) => {
    const n = new Date(d);
    n.setDate(n.getDate() + days);
    return n;
  };

  for (const h of holidaysFromDb) {
    if (!h.start_date || !h.end_date) continue;
    const [sy, sm, sd] = h.start_date.split('-').map(Number);
    const [ey, em, ed] = h.end_date.split('-').map(Number);
    let cursor = new Date(sy, sm - 1, sd, 0, 0, 0);
    const end = new Date(ey, em - 1, ed, 0, 0, 0);
    while (cursor <= end) {
      holidaySet.add(normalizeDateOnly(cursor));
      cursor = addDays(cursor, 1);
    }
  }
  console.log(`[ATTEND] Built holiday set with ${holidaySet.size} dates from ${holidaysFromDb.length} ranges.`);

  // Keep the same range and session-bound semantics used by projections and the tracker.
  const skipDays = db.getAllSync<{
    id: string; date: string; end_date: string | null; course_id: string | null;
    reason: string | null; time_start: string | null; time_end: string | null;
  }>('SELECT id, date, end_date, course_id, reason, time_start, time_end FROM skip_days').map(s => ({
    id: s.id,
    date: s.date,
    endDate: s.end_date || s.date,
    courseId: s.course_id || undefined,
    reason: s.reason || undefined,
    timeStart: s.time_start || undefined,
    timeEnd: s.time_end || undefined,
  }));
  console.log(`[ATTEND] Loaded ${skipDays.length} skip day entries.`);

  const isSkipDay = (dateString: string, courseId: string, timeStart: string, timeEnd: string): boolean =>
    isClassSkippedBySkipDay(dateString, courseId, timeStart, timeEnd, skipDays);

  // --- build existingRecordIds (DB ids + deterministic indices used by processors) ---
  const existingRecordRows = db.getAllSync<{ id: string; course_id: string; class_date: string; time_start: string | null; schedule_item_id: string | null }>(
    'SELECT id, course_id, class_date, time_start, schedule_item_id FROM attendance_records'
  );

  const existingRecordIds = new Set<string>();
  for (const r of existingRecordRows) {
    if (r.id) existingRecordIds.add(r.id);
    // also add the deterministic ids your processors generate: `${courseId}-${scheduleId}-${date}`
    if (r.schedule_item_id && r.class_date) {
      existingRecordIds.add(`${r.course_id}-${r.schedule_item_id}-${r.class_date}`);
    }
  }
  console.log(`[ATTEND] Found ${existingRecordIds.size} existing attendance identifiers.`);

  const newRecords: AttendanceRecord[] = [];
  const courseCounts: Record<string, AttendanceCounts> = {};

  for (const course of courses) {
    console.log(`[ATTEND] Processing course: ${course.name} (${course.id})`);

    // Always start from course creation date to fill ALL gaps since the course was created.
    // The existingRecordIds set prevents duplicate records from being created.
    let lastRecordDate: Date;
    if (course.createdAt) {
      lastRecordDate = /^\d{4}-\d{2}-\d{2}$/.test(course.createdAt)
        ? parseISOToDate(course.createdAt)
        : new Date(course.createdAt);
    } else {
      // fallback: start from today
      lastRecordDate = new Date();
    }

    console.log(`[ATTEND] Last record date for ${course.name}: ${lastRecordDate.toISOString()}`);

    const endDate = course.isArchived && course.archivedAt ? new Date(course.archivedAt) : now;
    console.log(`[ATTEND] Processing up to ${endDate.toISOString()}`);

    if (!courseCounts[course.id]) courseCounts[course.id] = emptyAttendanceCounts();

    // call processors (they will consult holidaySet & isSkipDay)
    processWeeklySchedule(
      course,
      lastRecordDate,
      endDate,
      now,
      existingRecordIds,
      newRecords,
      courseCounts,
      defaultStatus,
      holidaySet,
      isSkipDay
    );

    processExtraClasses(
      course,
      lastRecordDate,
      endDate,
      existingRecordIds,
      newRecords,
      courseCounts,
      defaultStatus,
      holidaySet,
      isSkipDay
    );
  }

  if (newRecords.length > 0) {
    console.log(`[ATTEND] Found ${newRecords.length} new attendance records to create.`);
    bulkAddAttendanceRecords(newRecords, courseCounts);
    console.log('[ATTEND] Finished creating missing attendance records.');
    return true;
  }

  console.log('[ATTEND] No new attendance records to create.');
  return false;
};


export const calculateAttendancePercentage = (presents: number, absents: number): number => {
  const safePresents = Math.max(0, Number.isFinite(presents) ? presents : 0);
  const safeAbsents = Math.max(0, Number.isFinite(absents) ? absents : 0);
  const totalClasses = safePresents + safeAbsents;
  if (totalClasses === 0) {
    return 100; // Return 100 if no classes have been held
  }
  const percentage = (safePresents / totalClasses) * 100;
  return Math.round(percentage);
};

export const getOldestRecordDate = (courses: Course[]): Date | null => {
  if (courses.length === 0) return null;

  // we need to filter out courses that should not be shown in heatmap
  const filteredCourses = courses.filter(course => course.attendanceRecords && course.showInHeatmap !== false);

  const allDates = filteredCourses.flatMap(c => c.attendanceRecords?.map(r => parseISOToDate(r.date)) ?? []);
  if (allDates.length === 0) return null;

  return new Date(Math.min(...allDates.map(d => d.getTime())));
};

/**
 * Returns the recorded class duration in minutes. Older records without valid
 * times retain a one-class weight so they continue to appear in the heatmap.
 */
const getAttendanceRecordDurationMinutes = (record: AttendanceRecord): number => {
  const parseTime = (time: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
  };

  const start = parseTime(record.timeStart);
  const end = parseTime(record.timeEnd);
  if (start === null || end === null || end <= start) return 1;

  return end - start;
};


export const generateHeatmapData = (courses: Course[], holidays: Holiday[], startDate: Date, endDate: Date): { date: Date; value: number; isHoliday: boolean; hasExtraClass: boolean }[] => {
  const dateMap: { [key: string]: { presentMinutes: number; absentMinutes: number; hasExtraClass: boolean } } = {};
  const holidayMap: { [key: string]: boolean } = {};

  holidays.forEach(holiday => {
    let current = parseISOToDate(holiday.startDate);
    const end = parseISOToDate(holiday.endDate);
    while (current <= end) {
      holidayMap[formatDateToISO(current)] = true;
      current.setDate(current.getDate() + 1);
    }
  });

  courses.forEach(course => {
    if (course.attendanceRecords && course.showInHeatmap !== false) {
      course.attendanceRecords.forEach(record => {
        const date = record.date;
        if (!dateMap[date]) {
          dateMap[date] = { presentMinutes: 0, absentMinutes: 0, hasExtraClass: false };
        }
        const durationMinutes = getAttendanceRecordDurationMinutes(record);
        if (record.status === 'present') {
          dateMap[date].presentMinutes += durationMinutes;
        } else if (record.status === 'absent') {
          dateMap[date].absentMinutes += durationMinutes;
        }
        if (record.isExtraClass) {
          dateMap[date].hasExtraClass = true;
        }
      });
    }
  });

  const heatmapData: { date: Date; value: number; isHoliday: boolean; hasExtraClass: boolean }[] = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const dateString = formatDateToISO(date); // Use formatDateToISO for consistency

    const isHoliday = holidayMap[dateString] || false;
    const hasExtraClass = dateMap[dateString]?.hasExtraClass || false;

    if (dateMap[dateString]) {
      const { presentMinutes, absentMinutes } = dateMap[dateString];
      const total = presentMinutes + absentMinutes;
      if (total === 0) {
        heatmapData.push({ date, value: -1, isHoliday, hasExtraClass }); // No classes with attendance marked
      } else {
        const percentage = (presentMinutes / total) * 100;
        heatmapData.push({ date, value: Math.round(percentage), isHoliday, hasExtraClass });
      }
    } else {
      heatmapData.push({ date, value: -1, isHoliday, hasExtraClass }); // No classes on this day
    }
  }

  return heatmapData;
};

/**
 * Calculate the projected date when attendance will reach the target percentage.
 * 
 * Skip days are treated as PLANNED ABSENCES - they will add to your absents count.
 * The target date accounts for these future absences when calculating how many
 * classes you need to attend to reach your target percentage.
 * 
 * @param course - The course to calculate for
 * @param holidays - Array of holidays to skip (no class happens)
 * @param skipDays - Array of skip days (planned absences)
 * @returns Object with targetDate, classesNeeded, and message
 */
export const calculateTargetDate = (
  course: Course,
  holidays: Holiday[],
  skipDays: SkipDay[]
): { targetDate: Date | null; classesNeeded: number; message: string } => {
  const presents = Math.max(0, Number.isFinite(course.presents) ? course.presents : 0);
  const absents = Math.max(0, Number.isFinite(course.absents) ? course.absents : 0);
  const rawRequiredAttendance = course.requiredAttendance ?? 75;
  const requiredAttendance = Number.isFinite(rawRequiredAttendance)
    ? Math.min(100, Math.max(0, rawRequiredAttendance))
    : 75;

  // Check if course has any weekly schedule or extra classes
  const hasWeeklySchedule = course.weeklySchedule && course.weeklySchedule.length > 0;
  const hasExtraClasses = course.extraClasses && course.extraClasses.length > 0;

  // Build a set of scheduled days (lowercase) for weekly schedule
  const scheduledDays = new Set<string>();
  if (hasWeeklySchedule) {
    course.weeklySchedule!.forEach(s => scheduledDays.add(s.day.toLowerCase()));
  }

  // Day name helper
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  // Build a set of all holiday dates
  const holidaySet = new Set<string>();
  for (const h of holidays) {
    let current = parseISOToDate(h.startDate);
    const end = parseISOToDate(h.endDate);
    while (current <= end) {
      holidaySet.add(formatDateToISO(current));
      current.setDate(current.getDate() + 1);
    }
  }

  // This is the same calendar-aware calculation used by the “bunk / attend” delta.
  const futureAbsences = getPlannedSkipDayAbsences(course, holidays, skipDays);

  // Calculate total classes including future absences from skip days
  const totalClasses = presents + absents;
  const projectedTotal = totalClasses + futureAbsences;
  const projectedAbsents = absents + futureAbsences;

  // Calculate projected percentage after skip days
  const projectedPercentage = projectedTotal > 0 ? (presents / projectedTotal) * 100 : 100;
  const currentPercentage = totalClasses > 0 ? (presents / totalClasses) * 100 : 100;
  const attendanceDelta = getAttendanceDelta(presents, absents, requiredAttendance, futureAbsences);

  // If already meeting target (even after accounting for future skip day absences)
  if (attendanceDelta <= 0) {
    return {
      targetDate: null,
      classesNeeded: 0,
      message: 'Already meeting target'
    };
  }

  if (!Number.isFinite(attendanceDelta)) {
    return {
      targetDate: null,
      classesNeeded: Number.POSITIVE_INFINITY,
      message: 'A 100% target cannot be recovered after an absence',
    };
  }

  // The shared delta formula is the single source of truth for recovery classes.
  const classesNeeded = attendanceDelta;

  if (classesNeeded <= 0) {
    return {
      targetDate: null,
      classesNeeded: 0,
      message: 'Already meeting target'
    };
  }

  if (!hasWeeklySchedule && !hasExtraClasses) {
    return {
      targetDate: null,
      classesNeeded,
      message: `Need ${classesNeeded} more classes but no schedule set`
    };
  }

  // Build a map of extra class dates to count (date -> number of classes on that date)
  // Start from tomorrow since today's classes may already be marked
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const tomorrowISO = formatDateToISO(tomorrow);

  const extraClassDates = new Map<string, number>();
  if (hasExtraClasses) {
    for (const ec of course.extraClasses!) {
      // Only count future extra classes (from tomorrow onwards)
      if (ec.date >= tomorrowISO) {
        extraClassDates.set(ec.date, (extraClassDates.get(ec.date) || 0) + 1);
      }
    }
  }

  // Iterate through future dates (starting tomorrow), counting attendable classes
  let currentDate = new Date(tomorrow);
  let classesFound = 0;
  const maxDaysToSearch = 365; // Limit search to 1 year

  for (let i = 0; i < maxDaysToSearch && classesFound < classesNeeded; i++) {
    const dateString = formatDateToISO(currentDate);
    const dayOfWeek = dayNames[currentDate.getDay()];

    // A holiday cancels every class. Skip days can instead apply to one session,
    // so filter sessions individually below.
    if (!holidaySet.has(dateString)) {
      let classesOnThisDay = 0;

      // Count weekly scheduled classes for this day
      if (scheduledDays.has(dayOfWeek)) {
        classesOnThisDay += course.weeklySchedule?.filter(s =>
          s.day.toLowerCase() === dayOfWeek &&
          !isClassSkippedBySkipDay(dateString, course.id, s.timeStart, s.timeEnd, skipDays)
        ).length || 0;
      }

      // Count extra classes on this date
      if (extraClassDates.has(dateString)) {
        classesOnThisDay += course.extraClasses?.filter(extraClass =>
          extraClass.date === dateString &&
          !isClassSkippedBySkipDay(dateString, course.id, extraClass.timeStart, extraClass.timeEnd, skipDays)
        ).length || 0;
      }

      classesFound += classesOnThisDay;
    }

    // If we've found enough classes, this is our target date
    if (classesFound >= classesNeeded) {
      return {
        targetDate: new Date(currentDate),
        classesNeeded,
        message: `Attend ${classesNeeded} more class${classesNeeded === 1 ? '' : 'es'}`
      };
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // If we couldn't find enough classes within the limit
  return {
    targetDate: null,
    classesNeeded,
    message: `Need ${classesNeeded} classes, but not enough scheduled`
  };
};
