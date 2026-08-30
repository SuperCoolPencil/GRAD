import { Course, AttendanceRecord, Holiday, SkipDay } from '@/types';
import { db, getSetting, bulkAddAttendanceRecords, getCourses } from './database';
import { formatDateToISO } from './dateHelpers'; // Import formatDateToISO

/**
 * Returns classes to attend (positive), classes that can be missed (negative),
 * or zero when the target is already met exactly.
 */
export const getAttendanceDelta = (
  presents: number,
  absents: number,
  requiredAttendance: number,
): number => {
  const total = presents + absents;
  const requiredFraction = requiredAttendance / 100;

  if (total === 0 || requiredFraction <= 0 || requiredFraction >= 1) return 0;

  return presents / total >= requiredFraction
    ? -Math.floor(presents / requiredFraction - total) || 0
    : Math.ceil((requiredFraction * total - presents) / (1 - requiredFraction));
};

const getDayOfWeek = (date: Date): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

const processWeeklySchedule = (
  course: any,
  lastRecordDate: Date,
  endDate: Date,
  now: Date,
  existingRecordIds: Set<unknown>,
  newRecords: AttendanceRecord[],
  courseCounts: { [courseId: string]: { presents: number; absents: number; cancelled: number } },
  defaultStatus: string,
  holidaySet?: Set<string>, // optional set of 'YYYY-MM-DD' strings
  isSkipDay?: (dateString: string, courseId: string) => boolean
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
          const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
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

          // holiday detection: skip holidays (no attendance records)
          const isHoliday = holidaySet
            ? holidaySet.has(dateString)
            : !!db.getFirstSync('SELECT id, name FROM holidays WHERE start_date <= ? AND end_date >= ? LIMIT 1', dateString, dateString);

          if (isHoliday) {
            console.log(`[ATTEND] Skipping scheduled class for ${course.name} on ${dateString} (holiday)`);
            continue;
          }

          // skip day detection: create ABSENT record (planned absence)
          if (isSkipDay && isSkipDay(dateString, course.id)) {
            newRecords.push({
              id: attendanceId,
              course_id: course.id,
              date: dateString,
              status: 'absent',
              isExtraClass: false,
              scheduleItemId: schedule.id,
              timeStart: schedule.timeStart,
              timeEnd: schedule.timeEnd,
            });

            if (!courseCounts[course.id]) courseCounts[course.id] = { presents: 0, absents: 0, cancelled: 0 };
            courseCounts[course.id].absents++;
            console.log(`[ATTEND] Created ABSENT record for ${course.name} on ${dateString} (skip day)`);
            continue;
          }

          // normal (non-holiday, non-skip) record
          newRecords.push({
            id: attendanceId,
            course_id: course.id,
            date: dateString,
            status: defaultStatus as 'present' | 'absent' | 'cancelled',
            isExtraClass: false,
            scheduleItemId: schedule.id,
            timeStart: schedule.timeStart,
            timeEnd: schedule.timeEnd,
          });

          if (!courseCounts[course.id]) courseCounts[course.id] = { presents: 0, absents: 0, cancelled: 0 };
          if (defaultStatus === 'present') courseCounts[course.id].presents++;
          else if (defaultStatus === 'absent') courseCounts[course.id].absents++;
          else if (defaultStatus === 'cancelled') courseCounts[course.id].cancelled++;

          console.log(`[ATTEND] Created ${defaultStatus.toUpperCase()} record for ${course.name} on ${dateString} at ${schedule.timeStart}`);
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
  courseCounts: { [courseId: string]: { presents: number; absents: number; cancelled: number } },
  defaultStatus: string,
  holidaySet?: Set<string>, // optional set of 'YYYY-MM-DD' strings
  isSkipDay?: (dateString: string, courseId: string) => boolean
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

        // holiday detection: skip holidays (no attendance records)
        const isHoliday = holidaySet
          ? holidaySet.has(extraClass.date)
          : !!db.getFirstSync('SELECT id, name FROM holidays WHERE start_date <= ? AND end_date >= ? LIMIT 1', extraClass.date, extraClass.date);

        if (isHoliday) {
          console.log(`[ATTEND] Skipping extra class for ${course.name} on ${extraClass.date} (holiday)`);
          continue;
        }

        // skip day detection: create ABSENT record (planned absence)
        if (isSkipDay && isSkipDay(extraClass.date, course.id)) {
          newRecords.push({
            id: attendanceId,
            course_id: course.id,
            date: extraClass.date,
            status: 'absent',
            isExtraClass: true,
            scheduleItemId: extraClass.id,
            timeStart: extraClass.timeStart,
            timeEnd: extraClass.timeEnd,
          });

          if (!courseCounts[course.id]) courseCounts[course.id] = { presents: 0, absents: 0, cancelled: 0 };
          courseCounts[course.id].absents++;
          console.log(`[ATTEND] Created ABSENT extra-class record for ${course.name} on ${extraClass.date} (skip day)`);
          continue;
        }

        // normal extra-class record
        newRecords.push({
          id: attendanceId,
          course_id: course.id,
          date: extraClass.date,
          status: defaultStatus as 'present' | 'absent' | 'cancelled',
          isExtraClass: true,
          scheduleItemId: extraClass.id,
          timeStart: extraClass.timeStart,
          timeEnd: extraClass.timeEnd,
        });

        if (!courseCounts[course.id]) courseCounts[course.id] = { presents: 0, absents: 0, cancelled: 0 };
        if (defaultStatus === 'present') courseCounts[course.id].presents++;
        else if (defaultStatus === 'absent') courseCounts[course.id].absents++;
        else if (defaultStatus === 'cancelled') courseCounts[course.id].cancelled++;

        console.log(`[ATTEND] Created ${defaultStatus.toUpperCase()} extra-class record for ${course.name} on ${extraClass.date} at ${extraClass.timeStart}`);
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

  const defaultStatus = (getSetting('defaultAttendanceStatus') as string) || 'absent';

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

  // --- build skipDaySet (YYYY-MM-DD) for all skip days ----------
  const skipDaySet = new Set<string>();
  const skipDaysFromDb = db.getAllSync<{ date: string; course_id: string | null }>('SELECT date, course_id FROM skip_days');
  for (const s of skipDaysFromDb) {
    if (s.date) {
      // Store as "date" or "date:courseId" to handle course-specific skip days
      if (s.course_id) {
        skipDaySet.add(`${s.date}:${s.course_id}`);
      } else {
        skipDaySet.add(s.date); // Applies to all courses
      }
    }
  }
  console.log(`[ATTEND] Built skip day set with ${skipDaySet.size} entries.`);

  // Helper to check if a date is a skip day for a specific course
  const isSkipDay = (dateString: string, courseId: string): boolean => {
    return skipDaySet.has(dateString) || skipDaySet.has(`${dateString}:${courseId}`);
  };

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
  const courseCounts: { [courseId: string]: { presents: number; absents: number; cancelled: number } } = {};

  for (const course of courses) {
    console.log(`[ATTEND] Processing course: ${course.name} (${course.id})`);

    // Always start from course creation date to fill ALL gaps since the course was created.
    // The existingRecordIds set prevents duplicate records from being created.
    let lastRecordDate: Date;
    if (course.createdAt) {
      lastRecordDate = new Date(course.createdAt);
    } else {
      // fallback: start from today
      lastRecordDate = new Date();
    }

    console.log(`[ATTEND] Last record date for ${course.name}: ${lastRecordDate.toISOString()}`);

    const endDate = course.isArchived && course.archivedAt ? new Date(course.archivedAt) : now;
    console.log(`[ATTEND] Processing up to ${endDate.toISOString()}`);

    if (!courseCounts[course.id]) courseCounts[course.id] = { presents: 0, absents: 0, cancelled: 0 };

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
  const totalClasses = presents + absents;
  if (totalClasses === 0) {
    return 100; // Return 100 if no classes have been held
  }
  const percentage = (presents / totalClasses) * 100;
  return Math.round(percentage);
};

export const getOldestRecordDate = (courses: Course[]): Date | null => {
  if (courses.length === 0) return null;

  // we need to filter out courses that should not be shown in heatmap
  const filteredCourses = courses.filter(course => course.attendanceRecords && course.showInHeatmap);

  const allDates = filteredCourses.flatMap(c => c.attendanceRecords?.map(r => new Date(r.date)) ?? []);
  if (allDates.length === 0) return null;

  return new Date(Math.min(...allDates.map(d => d.getTime())));
};


export const generateHeatmapData = (courses: Course[], holidays: Holiday[], startDate: Date, endDate: Date): { date: Date; value: number; isHoliday: boolean; hasExtraClass: boolean }[] => {
  const dateMap: { [key: string]: { presents: number; absents: number; hasExtraClass: boolean } } = {};
  const holidayMap: { [key: string]: boolean } = {};

  holidays.forEach(holiday => {
    let current = new Date(holiday.startDate);
    const end = new Date(holiday.endDate);
    while (current <= end) {
      holidayMap[formatDateToISO(current)] = true;
      current.setDate(current.getDate() + 1);
    }
  });

  courses.forEach(course => {
    if (course.attendanceRecords && course.showInHeatmap) {
      course.attendanceRecords.forEach(record => {
        const date = record.date;
        if (!dateMap[date]) {
          dateMap[date] = { presents: 0, absents: 0, hasExtraClass: false };
        }
        if (record.status === 'present') {
          dateMap[date].presents++;
        } else if (record.status === 'absent') {
          dateMap[date].absents++;
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
      const { presents, absents } = dateMap[dateString];
      const total = presents + absents;
      if (total === 0) {
        heatmapData.push({ date, value: -1, isHoliday, hasExtraClass }); // No classes with attendance marked
      } else {
        const percentage = (presents / total) * 100;
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
  const presents = course.presents || 0;
  const absents = course.absents || 0;
  const requiredAttendance = course.requiredAttendance || 75;

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
    let current = new Date(h.startDate);
    const end = new Date(h.endDate);
    while (current <= end) {
      holidaySet.add(formatDateToISO(current));
      current.setDate(current.getDate() + 1);
    }
  }

  // Build a set of skip days (only those applicable to this course or all courses)
  const skipDaySet = new Set<string>();
  console.log(`[TARGET] Processing ${skipDays.length} skip days for course ${course.id}`);
  for (const s of skipDays) {
    // If courseId is undefined/null, it applies to all courses
    // If courseId matches this course, it applies
    const applies = !s.courseId || s.courseId === course.id;
    console.log(`[TARGET] Skip day ${s.date}: courseId=${s.courseId || 'ALL'}, applies=${applies}`);
    if (applies) {
      skipDaySet.add(s.date);
    }
  }

  // Helper function to count scheduled classes on a given date
  const countClassesOnDate = (dateString: string): number => {
    const date = new Date(dateString + 'T00:00:00');
    const dayOfWeek = dayNames[date.getDay()];
    let count = 0;

    // Count weekly scheduled classes
    if (scheduledDays.has(dayOfWeek)) {
      count += course.weeklySchedule?.filter(
        s => s.day.toLowerCase() === dayOfWeek
      ).length || 0;
    }

    // Count extra classes on this date
    if (hasExtraClasses) {
      count += course.extraClasses!.filter(ec => ec.date === dateString).length;
    }

    return count;
  };

  // Count future absences: classes that will happen on skip days (not holidays)
  // Use tomorrow as cutoff since today's classes may already be marked
  const tomorrowForSkipDays = new Date();
  tomorrowForSkipDays.setDate(tomorrowForSkipDays.getDate() + 1);
  const tomorrowSkipISO = formatDateToISO(tomorrowForSkipDays);

  let futureAbsences = 0;
  for (const skipDate of skipDaySet) {
    // Only count future skip days (from tomorrow), not holidays
    if (skipDate >= tomorrowSkipISO && !holidaySet.has(skipDate)) {
      futureAbsences += countClassesOnDate(skipDate);
    }
  }

  // Calculate total classes including future absences from skip days
  const totalClasses = presents + absents;
  const projectedTotal = totalClasses + futureAbsences;
  const projectedAbsents = absents + futureAbsences;

  // Calculate projected percentage after skip days
  const projectedPercentage = projectedTotal > 0 ? (presents / projectedTotal) * 100 : 100;
  console.log(`[TARGET] Current: ${presents}P/${absents}A = ${(presents / (presents + absents) * 100).toFixed(1)}%`);
  console.log(`[TARGET] Projected: ${presents}P/${projectedAbsents}A (total ${projectedTotal}) = ${projectedPercentage.toFixed(1)}%`);

  // If already meeting target (even after accounting for future skip day absences)
  if (projectedPercentage >= requiredAttendance) {
    console.log(`[TARGET] Still meeting target after skip days`);
    return {
      targetDate: null,
      classesNeeded: 0,
      message: 'Already meeting target'
    };
  }

  // Calculate classes needed to reach target after accounting for future absences
  // Formula: (presents + x) / (projectedTotal + x) >= target/100
  // Solving for x: x >= (target * projectedTotal - 100 * presents) / (100 - target)
  const requiredFraction = requiredAttendance / 100;
  const classesNeeded = Math.ceil(
    (requiredFraction * projectedTotal - presents) / (1 - requiredFraction)
  );

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

    // Skip if it's a holiday or skip day (can't attend on these days)
    if (!holidaySet.has(dateString) && !skipDaySet.has(dateString)) {
      let classesOnThisDay = 0;

      // Count weekly scheduled classes for this day
      if (scheduledDays.has(dayOfWeek)) {
        classesOnThisDay += course.weeklySchedule?.filter(
          s => s.day.toLowerCase() === dayOfWeek
        ).length || 0;
      }

      // Count extra classes on this date
      if (extraClassDates.has(dateString)) {
        classesOnThisDay += extraClassDates.get(dateString) || 0;
      }

      if (classesOnThisDay > 0) {
        console.log(`[TARGET] ${dateString} (${dayOfWeek}): +${classesOnThisDay} classes, total=${classesFound + classesOnThisDay}`);
      }
      classesFound += classesOnThisDay;
    } else {
      const reason = holidaySet.has(dateString) ? 'holiday' : 'skip day';
      console.log(`[TARGET] ${dateString} (${dayOfWeek}): SKIPPED (${reason})`);
    }

    // If we've found enough classes, this is our target date
    if (classesFound >= classesNeeded) {
      console.log(`[TARGET] Found ${classesFound} classes, target date = ${dateString}`);
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
