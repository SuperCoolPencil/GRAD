import { Course, AttendanceRecord, ScheduleItem } from '@/types';
import { db, getSetting, updateSetting, bulkAddAttendanceRecords, bulkUpdateCourseCounts } from './database';

export const createMissingAttendanceRecords = () => {
  console.log('Starting to create missing attendance records...');
  const now = new Date();
  const courses = db.getAllSync('SELECT * FROM courses').map((c: any) => ({
    id: c.id,
    name: c.name,
    createdAt: c.created_at,
    archivedAt: c.archived_at,
    isArchived: c.is_archived,
    weeklySchedule: db.getAllSync('SELECT * FROM weekly_schedules WHERE course_id = ?', c.id).map((s: any) => ({
      id: s.id,
      day: s.day,
      timeStart: s.time_start,
      timeEnd: s.time_end,
    })),
    extraClasses: db.getAllSync('SELECT * FROM extra_classes WHERE course_id = ?', c.id).map((e: any) => ({
      id: e.id,
      date: e.date,
      timeStart: e.time_start,
      timeEnd: e.time_end,
    })),
  }));

  console.log(`Found ${courses.length} courses to process.`);

  const defaultStatus = getSetting('defaultAttendanceStatus') || 'absent';
  const allAttendanceRecords = db.getAllSync('SELECT id FROM attendance_records');
  const existingRecordIds = new Set(allAttendanceRecords.map((r: any) => r.id));
  const newRecords: AttendanceRecord[] = [];
  const courseCounts: { [courseId: string]: { presents: number, absents: number, cancelled: number } } = {};

  for (const course of courses) {
    console.log(`Processing course: ${course.name} (${course.id})`);
    const lastRecord = db.getFirstSync<AttendanceRecord>(
      'SELECT * FROM attendance_records WHERE course_id = ? ORDER BY class_date DESC, time_end DESC LIMIT 1',
      course.id
    );

    let lastRecordDate = new Date();
    if (lastRecord && lastRecord.date && lastRecord.timeEnd) {
      const [year, month, day] = lastRecord.date.split('-').map(Number);
      const [hour, minute] = lastRecord.timeEnd.split(':').map(Number);
      lastRecordDate = new Date(year, month - 1, day, hour, minute);
    } else if (course.createdAt) {
      lastRecordDate = new Date(course.createdAt);
    }
    console.log(`Last record date for course ${course.name}: ${lastRecordDate}`);

    const endDate = course.isArchived && course.archivedAt ? new Date(course.archivedAt) : now;
    console.log(`Processing records up to ${endDate}`);

    // Weekly schedule
    let currentDate = new Date(lastRecordDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      for (const schedule of course.weeklySchedule) {
        if (schedule.day.toLowerCase() === dayOfWeek) {
          const classDateTime = new Date(currentDate.toDateString() + ' ' + schedule.timeEnd);
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

    // Extra classes
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
  }

  console.log(`Found ${newRecords.length} new attendance records to create.`);
  bulkAddAttendanceRecords(newRecords);
  bulkUpdateCourseCounts(courseCounts);
  console.log('Finished creating missing attendance records.');
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

  const allDates = courses.flatMap(c => c.attendanceRecords?.map(r => new Date(r.date)) ?? []);
  if (allDates.length === 0) return null;

  return new Date(Math.min(...allDates.map(d => d.getTime())));
};


export const generateHeatmapData = (courses: Course[], startDate: Date, endDate: Date): { date: Date; value: number; isFirstDayOfMonth: boolean }[] => {
  const dateMap: { [key: string]: { presents: number; absents: number } } = {};

  courses.forEach(course => {
    if (course.attendanceRecords) {
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
    const dateString = date.toISOString().slice(0, 10);

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
