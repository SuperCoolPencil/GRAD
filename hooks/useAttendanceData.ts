import { useState, useEffect, useCallback, useContext } from 'react';
import { AppContext } from '@/context/AppContext';
import { Course, ScheduleItem, AttendanceRecord } from '@/types';
import {
  formatDateToISO,
  getWeekStartDate,
  addDaysToDate,
  dayIndexToName,
  isDateInPast,
  parse24HToDate,
} from '@/utils/dateHelpers';
import { Colors } from '@/constants/Colors';

interface ClassSession extends ScheduleItem {
  isExtraClass: boolean;
  date?: string;
}

export interface ClassItem {
  course: Course;
  schedule: ClassSession;
  attendance?: AttendanceRecord;
}

export const useAttendanceData = (startDate: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6, filterCourses = false) => {
  const { courses: appCourses } = useContext(AppContext);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<Record<string, ClassItem[]>>({});
  const [courseColors, setCourseColors] = useState<Record<string, string>>({});
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(23);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCourseColor = (course: Course, allCourseIds: string[]) => {
    if (course.color) {
      return course.color;
    }
    const colorNames = Object.keys(Colors.courseColors);
    const index = allCourseIds.indexOf(course.id);
    const colorName = colorNames[index % colorNames.length];
    return Colors.courseColors[colorName as keyof typeof Colors.courseColors];
  };

  const fetchCoursesAndSchedule = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      let allCourses = appCourses;

      if (filterCourses) {
        allCourses = allCourses.filter(course => course.showInTracker);
      }

      console.log(`[ATTEND] Found ${allCourses.length} courses with attendance records.`);

      setCourses(allCourses);

      const allCourseIds = appCourses.map(c => c.id);
      const newColors: Record<string, string> = {};
      appCourses.forEach(course => { newColors[course.id] = course.color || getCourseColor(course, allCourseIds); });
      setCourseColors(newColors);

    } catch (e) {

      setError('Failed to load schedule. Please try again.');
      console.error(e);

    } finally {
      setLoading(false);
    }
  }, [appCourses, filterCourses]);

  useEffect(() => {
    fetchCoursesAndSchedule();
  }, [fetchCoursesAndSchedule]);

  useEffect(() => {
    const newClasses: Record<string, ClassItem[]> = {};
    const weekStartDate = getWeekStartDate(startDate, weekStartsOn);

    for (let i = 0; i < 7; i++) {
      const date = addDaysToDate(weekStartDate, i);
      const dateString = formatDateToISO(date);
      newClasses[dateString] = [];

      const dayOfWeek = dayIndexToName(date.getDay());

      if (isDateInPast(date)) {
        // Process past classes using attendance records
        const attendanceRecords = courses.flatMap(course =>
          (course.attendanceRecords || []).filter(record => record.date === dateString),
        );
        console.log(`[ATTEND] Found ${attendanceRecords.length} attendance records for ${dateString}.`);

        attendanceRecords.forEach(record => {
          const course = courses.find(c => c.id === record.course_id);
          if (record.status === 'cancelled') return;
          if (!course || !course.showInTracker) return;
          // console.log("Rendering record:", record.id, "for course:", course.id);
          const classItem: ClassItem = {
            course,
            schedule: {
              id: record.id,
              day: dayOfWeek,
              timeStart: record.timeStart,
              timeEnd: record.timeEnd,
              isExtraClass: record.isExtraClass,
            },
            attendance: record,
          };
          newClasses[dateString].push(classItem);
        });

      } else {
        // Process regular weekly schedule for future and today
        courses.forEach(course => {

          // For weekly schedule we dont take archived
          if (course.isArchived || !course.showInTracker) return;

          // 1) Add weekly scheduled classes
          course.weeklySchedule
            ?.filter(item => item.day === dayOfWeek)
            .forEach(item => {
              newClasses[dateString].push({
                course,
                schedule: { ...item, isExtraClass: false },
              });
            });

          // 2) Add extra one-time classes
          course.extraClasses
            ?.filter(ec => ec.date === dateString)
            .forEach(ec => {
              newClasses[dateString].push({
                course,
                schedule: { ...ec, day: dayOfWeek, isExtraClass: true },
              });
            });
        });

        // Sort classes by start time
        newClasses[dateString].sort((a, b) =>
          a.schedule.timeStart.localeCompare(b.schedule.timeStart)
        );
      }
    }

    // After processing all days, update classes and calculate time range
    setClasses(newClasses);

    let minHour = Infinity;
    let maxHour = -Infinity;

    Object.values(newClasses)
      .flat()
      .forEach(classItem => {
        const start = parse24HToDate(classItem.schedule.timeStart);
        const end = parse24HToDate(classItem.schedule.timeEnd);
        minHour = Math.min(minHour, start.getHours() + start.getMinutes() / 60);
        maxHour = Math.max(maxHour, end.getHours() + end.getMinutes() / 60);
      });

    if (minHour !== Infinity) {
      // Keep a compact half-hour breathing band above and below the schedule.
      setStartHour(minHour > 0.5 ? minHour - 0.5 : 0);
      setEndHour(Math.min(maxHour + 0.5, 24));
    } else {
      // Default view when there are no classes
      setStartHour(8);
      setEndHour(12);
    }

    console.log(`[ATTEND] Classes loaded for ${Object.keys(newClasses).length} days starting from ${formatDateToISO(weekStartDate)}.`);

  }, [courses, startDate, weekStartsOn]);

  return { classes, courseColors, startHour, endHour, loading, error, refetch: fetchCoursesAndSchedule };
};
