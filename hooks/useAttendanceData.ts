import { useState, useEffect, useCallback } from 'react';
import { getCoursesWithRecordsInRange, getWeeklySchedule, getCourses } from '@/utils/database';
import { Course, ScheduleItem, ExtraClass, AttendanceRecord } from '@/types';
import {
  formatDateToISO,
  getWeekStartDate,
  getWeekEndDate,
  addDaysToDate,
  dayIndexToName,
  isDateInPast,
  parse24HToDate,
} from '@/utils/dateHelpers';

interface ClassSession extends ScheduleItem {
  isExtraClass: boolean;
  date?: string;
}

export interface ClassItem {
  course: Course;
  schedule: ClassSession;
  attendance?: AttendanceRecord;
}

export const useAttendanceData = (startDate: Date) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<Record<string, ClassItem[]>>({});
  const [courseColors, setCourseColors] = useState<Record<string, string>>({});
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(23);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colorPalette = [
    '#F28500', // Tangerine
    '#5F8575', // Basil
    '#33A1C9', // Peacock
    '#4F86F7', // Blueberry
    '#B284BE', // Lavender
    '#6F2DA8', // Grape
    '#FF88A7', // Flamingo
    '#616161', // Graphite
    '#87CEEB', // Sky Blue
  ];

  const getCourseColor = (course: Course, allCourseIds: string[]) => {
    if (course.color) {
      return course.color;
    }
    const index = allCourseIds.indexOf(course.id);
    return colorPalette[index % colorPalette.length];
  };

  const fetchCoursesAndSchedule = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const currentStartDate = startDate;
      const currentEndDate = addDaysToDate(startDate, 6);

      const allCourses = getCoursesWithRecordsInRange(
        formatDateToISO(currentStartDate),
        formatDateToISO(currentEndDate)
      );
      setCourses(allCourses);

      const allCoursesList = getCourses();
      const allCourseIds = allCoursesList.map(c => c.id);
      const newColors: Record<string, string> = {};
      allCoursesList.forEach(course => {
        if (!course.isArchived) {
          newColors[course.id] = course.color || getCourseColor(course, allCourseIds);
        }
      });
      setCourseColors(newColors);
    } catch (e) {
      setError('Failed to load schedule. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => {
    fetchCoursesAndSchedule();
  }, [fetchCoursesAndSchedule]);

  useEffect(() => {
    const newClasses: Record<string, ClassItem[]> = {};

    for (let i = 0; i < 7; i++) {
      const date = addDaysToDate(startDate, i);
      const dateString = formatDateToISO(date);
      newClasses[dateString] = [];

      const dayOfWeek = dayIndexToName(date.getDay());
      const schedule = getWeeklySchedule();

      // Process regular weekly schedule
      schedule.forEach(item => {
        if (item.day === dayOfWeek) {
          const course = courses.find(c => c.id === (item as any).course_id);
          if (course) {
            const attendance = course.attendanceRecords?.find(
              r => r.date === dateString && r.scheduleItemId === item.id && !r.isExtraClass
            );
            newClasses[dateString].push({
              course,
              schedule: { ...item, isExtraClass: false },
              attendance,
            });
          }
        }
      });

      // Process extra classes
      courses.forEach(course => {
        course.extraClasses?.forEach(extraClass => {
          if (extraClass.date === dateString) {
            const attendance = course.attendanceRecords?.find(
              r => r.date === dateString && r.scheduleItemId === extraClass.id && r.isExtraClass
            );
            const session: ClassSession = { ...extraClass, day: dayOfWeek, isExtraClass: true };
            newClasses[dateString].push({
              course,
              schedule: session,
              attendance,
            });
          }
        });
      });

      // Add past attendance records that might not have a schedule item (e.g., from older app versions)
      if (isDateInPast(date)) {
        courses.forEach(course => {
          course.attendanceRecords?.forEach(record => {
            if (record.date === dateString) {
              // Avoid duplicating records that are already matched
              const alreadyExists = newClasses[dateString].some(c => c.attendance?.id === record.id);
              if (!alreadyExists) {
                const scheduleItem: ClassSession = record.isExtraClass
                  ? { ...record, day: dayIndexToName(date.getDay()), isExtraClass: true }
                  : { id: record.scheduleItemId!, day: dayIndexToName(date.getDay()), timeStart: record.timeStart, timeEnd: record.timeEnd, isExtraClass: false };
                
                newClasses[dateString].push({
                  course,
                  schedule: scheduleItem,
                  attendance: record,
                });
              }
            }
          });
        });
      }

      newClasses[dateString].sort((a, b) => a.schedule.timeStart.localeCompare(b.schedule.timeStart));
    }

    let minHour = Infinity;
    let maxHour = -Infinity;

    Object.values(newClasses).flat().forEach(classItem => {
      const start = parse24HToDate(classItem.schedule.timeStart);
      const end = parse24HToDate(classItem.schedule.timeEnd);
      minHour = Math.min(minHour, start.getHours());
      maxHour = Math.max(maxHour, end.getHours() + end.getMinutes() / 60);
    });

    if (minHour !== Infinity) {
      setStartHour(minHour - 1);
      setEndHour(maxHour);
    } else {
      setStartHour(8);
      setEndHour(18);
    }

    setClasses(newClasses);
  }, [courses, startDate]);

  return { classes, courseColors, startHour, endHour, loading, error, refetch: fetchCoursesAndSchedule };
};
