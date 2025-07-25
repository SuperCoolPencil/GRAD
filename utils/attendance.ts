import { Course } from '@/types';

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

export const getActiveDaysFromData = (data: { date: Date; value: number }[]): number[] => {
  const activeDays = new Set<number>();
  data.forEach(item => {
    if (item.value !== -1) {
      activeDays.add(item.date.getDay());
    }
  });
  return Array.from(activeDays).sort((a, b) => a - b);
};

export const generateHeatmapData = (courses: Course[], startDate: Date, endDate: Date): { date: Date; value: number }[] => {
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

  const heatmapData: { date: Date; value: number }[] = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const dateString = date.toISOString().slice(0, 10);

    if (dateMap[dateString]) {
      const { presents, absents } = dateMap[dateString];
      const total = presents + absents;
      if (total === 0) {
        heatmapData.push({ date, value: -1 }); // No classes with attendance marked
      } else {
        const percentage = (presents / total) * 100;
        heatmapData.push({ date, value: Math.round(percentage) });
      }
    } else {
      heatmapData.push({ date, value: -1 }); // No classes on this day
    }
  }

  return heatmapData;
};
