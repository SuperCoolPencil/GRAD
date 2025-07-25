import { Course } from '@/types';

export const calculateAttendancePercentage = (presents: number, absents: number): number => {
  const totalClasses = presents + absents;
  if (totalClasses === 0) {
    return 100; // Return 100 if no classes have been held
  }
  const percentage = (presents / totalClasses) * 100;
  return Math.round(percentage);
};

export const generateHeatmapData = (courses: Course[]) => {
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

  const heatmapData = [];
  const today = new Date();
  for (let i = 365; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateString = date.toISOString().slice(0, 10);

    if (dateMap[dateString]) {
      const { presents, absents } = dateMap[dateString];
      const total = presents + absents;
      if (total === 0) {
        heatmapData.push(0); // No classes with attendance marked
      } else {
        const percentage = presents / total;
        if (percentage === 1) {
          heatmapData.push(101); // Special value for 100%
        } else {
          // +1 to shift 0-99 range to 1-100. 0 is for no class.
          heatmapData.push(Math.floor(percentage * 100) + 1);
        }
      }
    } else {
      heatmapData.push(0); // No classes on this day
    }
  }

  return heatmapData;
};
