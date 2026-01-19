import { Course, AttendanceRecord, ScheduleItem, Holiday, SkipDay } from '@/types';
import { db, getSetting, updateSetting, bulkAddAttendanceRecords, bulkUpdateCourseCounts, getCourses } from './database';
import { formatDateToISO } from './dateHelpers'; // Import formatDateToISO

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
  holidayBehavior: 'skip' | 'cancel' = 'skip'
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

          // holiday detection: use holidaySet if provided, otherwise fall back to DB-range lookup
          const isHoliday = holidaySet
            ? holidaySet.has(dateString)
            : !!db.getFirstSync('SELECT id, name FROM holidays WHERE start_date <= ? AND end_date >= ? LIMIT 1', dateString, dateString);

          if (isHoliday) {
            if (holidayBehavior === 'skip') {
              console.log(`[ATTEND] Skipping scheduled class for ${course.name} on ${dateString} (holiday)`);
              continue;
            }

            // create CANCELLED record for holiday
            newRecords.push({
              id: attendanceId,
              course_id: course.id,
              date: dateString,
              status: 'cancelled',
              isExtraClass: false,
              scheduleItemId: schedule.id,
              timeStart: schedule.timeStart,
              timeEnd: schedule.timeEnd,
            });

            if (!courseCounts[course.id]) courseCounts[course.id] = { presents: 0, absents: 0, cancelled: 0 };
            courseCounts[course.id].cancelled++;
            console.log(`[ATTEND] Created CANCELLED record for ${course.name} on ${dateString} (holiday)`);
            continue;
          }

          // normal (non-holiday) record
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
  holidayBehavior: 'cancel' | 'skip' = 'cancel'
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

        // holiday detection
        const isHoliday = holidaySet
          ? holidaySet.has(extraClass.date)
          : !!db.getFirstSync('SELECT id, name FROM holidays WHERE start_date <= ? AND end_date >= ? LIMIT 1', extraClass.date, extraClass.date);

        if (isHoliday) {
          if (holidayBehavior === 'skip') {
            console.log(`[ATTEND] Skipping extra class for ${course.name} on ${extraClass.date} (holiday)`);
            continue;
          }

          newRecords.push({
            id: attendanceId,
            course_id: course.id,
            date: extraClass.date,
            status: 'cancelled',
            isExtraClass: true,
            scheduleItemId: extraClass.id,
            timeStart: extraClass.timeStart,
            timeEnd: extraClass.timeEnd,
          });

          if (!courseCounts[course.id]) courseCounts[course.id] = { presents: 0, absents: 0, cancelled: 0 };
          courseCounts[course.id].cancelled++;
          console.log(`[ATTEND] Created CANCELLED extra-class record for ${course.name} on ${extraClass.date} (holiday)`);
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
  const holidayBehavior = ((getSetting('holidayBehavior') as string) || 'skip').toLowerCase(); // 'skip' | 'cancel'

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

    // call processors (they will consult holidaySet & holidayBehavior)
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
      (holidayBehavior === 'skip' ? 'skip' : 'cancel')
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
      (holidayBehavior === 'skip' ? 'skip' : 'cancel')
    );
  }

  if (newRecords.length > 0) {
    console.log(`[ATTEND] Found ${newRecords.length} new attendance records to create.`);
    bulkAddAttendanceRecords(newRecords);
    bulkUpdateCourseCounts(courseCounts);
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
 * @param course - The course to calculate for
 * @param holidays - Array of holidays to skip
 * @param skipDays - Array of skip days to exclude
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
  const totalClasses = presents + absents;

  // Calculate current percentage
  const currentPercentage = totalClasses > 0 ? (presents / totalClasses) * 100 : 100;

  // If already meeting target
  if (currentPercentage >= requiredAttendance) {
    return {
      targetDate: null,
      classesNeeded: 0,
      message: 'Already meeting target'
    };
  }

  // Calculate classes needed to reach target
  // Formula: (presents + x) / (total + x) >= target/100
  // Solving for x: x >= (target * total - 100 * presents) / (100 - target)
  const requiredFraction = requiredAttendance / 100;
  const classesNeeded = Math.ceil(
    (requiredFraction * totalClasses - presents) / (1 - requiredFraction)
  );

  if (classesNeeded <= 0) {
    return {
      targetDate: null,
      classesNeeded: 0,
      message: 'Already meeting target'
    };
  }

  // Check if course has any weekly schedule or extra classes
  const hasWeeklySchedule = course.weeklySchedule && course.weeklySchedule.length > 0;
  const hasExtraClasses = course.extraClasses && course.extraClasses.length > 0;

  if (!hasWeeklySchedule && !hasExtraClasses) {
    return {
      targetDate: null,
      classesNeeded,
      message: `Need ${classesNeeded} more classes but no schedule set`
    };
  }

  // Build a set of scheduled days (lowercase) for weekly schedule
  const scheduledDays = new Set<string>();
  if (hasWeeklySchedule) {
    course.weeklySchedule!.forEach(s => scheduledDays.add(s.day.toLowerCase()));
  }

  // Build a map of extra class dates to count (date -> number of classes on that date)
  const extraClassDates = new Map<string, number>();
  if (hasExtraClasses) {
    const todayISO = formatDateToISO(new Date());
    for (const ec of course.extraClasses!) {
      // Only count future extra classes
      if (ec.date >= todayISO) {
        extraClassDates.set(ec.date, (extraClassDates.get(ec.date) || 0) + 1);
      }
    }
  }

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
  for (const s of skipDays) {
    // If courseId is undefined/null, it applies to all courses
    // If courseId matches this course, it applies
    if (!s.courseId || s.courseId === course.id) {
      skipDaySet.add(s.date);
    }
  }

  // Day name helper
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  // Iterate through future dates (including today), counting classes until we reach the target
  const today = new Date();
  let currentDate = new Date(today);
  currentDate.setHours(0, 0, 0, 0);

  // Start from today (not tomorrow) to include today's remaining classes

  let classesFound = 0;
  const maxDaysToSearch = 365; // Limit search to 1 year

  for (let i = 0; i < maxDaysToSearch && classesFound < classesNeeded; i++) {
    const dateString = formatDateToISO(currentDate);
    const dayOfWeek = dayNames[currentDate.getDay()];

    // Skip if it's a holiday or skip day
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
