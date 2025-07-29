import { Course, AttendanceRecord, ScheduleItem } from '@/types';
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
  defaultStatus: string
) => {

  // No need to check here if course is archived or not,
  // as endDate is already set to course.archivedAt if it exists.

  if (!course.weeklySchedule || course.weeklySchedule.length === 0) return;
  
  let currentDate = new Date(lastRecordDate);
  while (currentDate <= endDate) {
    const dayOfWeek = getDayOfWeek(currentDate);
    for (const schedule of course.weeklySchedule) {
      if (schedule.day.toLowerCase() === dayOfWeek) {
        const [hours, minutes] = schedule.timeEnd.split(':').map(Number);
        // Build new Date with the same Y/M/D but custom time
        const classDateTime = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          hours,
          minutes
        );
        if (classDateTime > lastRecordDate && classDateTime <= now) {
          const dateString = currentDate.toISOString().split('T')[0];
          const attendanceId = `${course.id}-${schedule.id}-${dateString}`;

          if (!existingRecordIds.has(attendanceId)) {
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
          }
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
  defaultStatus: string
) => {
  for (const extraClass of course.extraClasses) {
    if (extraClass.date && extraClass.timeEnd) {
      const [year, month, day] = extraClass.date.split('-').map(Number);
      const [hour, minute] = extraClass.timeEnd.split(':').map(Number);
      const extraClassDateTime = new Date(year, month - 1, day, hour, minute);
      if (extraClassDateTime > lastRecordDate && extraClassDateTime <= endDate) {
        const attendanceId = `${course.id}-${extraClass.id}-${extraClass.date}`;
        if (!existingRecordIds.has(attendanceId)) {
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
        }
      }
    }
  }
};

export const createMissingAttendanceRecords = (): boolean => {
  if (!db) throw new Error('DB not initialized');
  console.log('[ATTEND] Starting to create missing attendance records...');
  const now = new Date();
  const courses = getCourses();

  console.log(`[ATTEND] Found ${courses.length} courses to process.`);

  const defaultStatus = getSetting('defaultAttendanceStatus') || 'absent';
  const allAttendanceRecords = db!.getAllSync('SELECT id FROM attendance_records');
  const existingRecordIds = new Set(allAttendanceRecords.map((r: any) => r.id));
  const newRecords: AttendanceRecord[] = [];
  const courseCounts: { [courseId: string]: { presents: number, absents: number, cancelled: number } } = {};

  for (const course of courses) {
    console.log(`[ATTEND] Processing course: ${course.name} (${course.id})`);

    let lastRecordDate = new Date();

    const lastRecord = db!.getFirstSync<AttendanceRecord>(
      'SELECT * FROM attendance_records WHERE course_id = ? ORDER BY class_date DESC, time_end DESC LIMIT 1',
      course.id
    );

    if (lastRecord && lastRecord.date && lastRecord.timeEnd) {
      const [year, month, day] = lastRecord.date.split('-').map(Number);
      const [hour, minute] = lastRecord.timeEnd.split(':').map(Number);
      lastRecordDate = new Date(year, month - 1, day, hour, minute);
    } else if (course.createdAt) {
      lastRecordDate = new Date(course.createdAt);
    }

    console.log(`[ATTEND] Last record date for course ${course.name}: ${lastRecordDate}`);

    const endDate = course.isArchived && course.archivedAt ? new Date(course.archivedAt) : now;
    console.log(`[ATTEND] Processing records up to ${endDate}`);

    processWeeklySchedule(course, lastRecordDate, endDate, now, existingRecordIds, newRecords, courseCounts, defaultStatus);
    processExtraClasses(course, lastRecordDate, endDate, existingRecordIds, newRecords, courseCounts, defaultStatus);
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


export const generateHeatmapData = (courses: Course[], startDate: Date, endDate: Date): { date: Date; value: number; isFirstDayOfMonth: boolean }[] => {
  const dateMap: { [key: string]: { presents: number; absents: number } } = {};

  courses.forEach(course => {
    if (course.attendanceRecords && course.showInHeatmap) {
      course.attendanceRecords.forEach(record => {
        const date = record.date;
        if (!dateMap[date]) {
          dateMap[date] = { presents: 0, absents: 0 };
        }
        if (record.status === 'present') {
          dateMap[date].presents++;
        } else if (record.status === 'absent') {
          dateMap[date].absents++;
        }
      });
    }
  });

  const heatmapData: { date: Date; value: number; isFirstDayOfMonth: boolean }[] = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const dateString = formatDateToISO(date); // Use formatDateToISO for consistency

    const isFirstDayOfMonth = date.getDate() === 1;
    if (dateMap[dateString]) {
      const { presents, absents } = dateMap[dateString];
      const total = presents + absents;
      if (total === 0) {
        heatmapData.push({ date, value: -1, isFirstDayOfMonth }); // No classes with attendance marked
      } else {
        const percentage = (presents / total) * 100;
        heatmapData.push({ date, value: Math.round(percentage), isFirstDayOfMonth });
      }
    } else {
      heatmapData.push({ date, value: -1, isFirstDayOfMonth }); // No classes on this day
    }
  }

  return heatmapData;
};
