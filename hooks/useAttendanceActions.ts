import { useContext } from 'react';
import { AppContext } from '@/context/AppContext';
import { AttendanceRecord, Course, ScheduleItem, SkipDay } from '@/types';
import { useCustomAlert } from '@/context/AlertContext';
import { formatDateToISO, isDateInPast } from '@/utils/dateHelpers';
import { simulateBunkClass } from '@/utils/attendance';

interface ClassSession extends ScheduleItem {
  isExtraClass: boolean;
  date?: string;
}

export interface ClassItem {
  course: Course;
  schedule: ClassSession;
  attendance?: AttendanceRecord;
}

export const useAttendanceActions = () => {
  const { upsertAttendance, holidays, skipDays, addSkipDay } = useContext(AppContext);
  const { showAlert } = useCustomAlert();

  const handleSelectClass = (classItem: ClassItem, date: Date) => {
    const { course, schedule } = classItem;
    const dateString = formatDateToISO(date);
    const todayISO = formatDateToISO(new Date());

    const isFuture = dateString > todayISO;

    if (isFuture) {
      const simulation = simulateBunkClass(course, holidays, skipDays, 1);
      const isAlreadySkipped = skipDays.some(
        s => (!s.courseId || s.courseId === course.id) &&
             dateString >= s.date &&
             dateString <= (s.endDate || s.date) &&
             (!s.timeStart || s.timeStart <= schedule.timeStart) &&
             (!s.timeEnd || s.timeEnd >= schedule.timeEnd)
      );

      showAlert(
        `Can I bunk ${course.name}?`,
        `Date: ${dateString} (${schedule.timeStart} - ${schedule.timeEnd})\n` +
        `Current: ${simulation.currentPercentage}%\n` +
        `If skipped: ${simulation.simulatedPercentage}%\n\n` +
        `${simulation.message}`,
        [
          {
            text: isAlreadySkipped ? 'Already Planned as Skip' : 'Plan to Bunk (Add Skip Day)',
            style: isAlreadySkipped ? 'cancel' : 'default',
            onPress: () => {
              if (!isAlreadySkipped) {
                const newSkipDay: SkipDay = {
                  id: `skip-${Date.now()}`,
                  date: dateString,
                  endDate: dateString,
                  courseId: course.id,
                  reason: `Bunking ${course.name}`,
                  timeStart: schedule.timeStart,
                  timeEnd: schedule.timeEnd,
                };
                addSkipDay(newSkipDay);
              }
            },
          },
          { text: 'Close', style: 'cancel' },
        ]
      );
      return;
    }

    const handleAttendanceChange = (newStatus: 'present' | 'absent' | 'cancelled') => {
      upsertAttendance(course.id, schedule.id, newStatus, schedule.isExtraClass, schedule.timeStart, schedule.timeEnd, dateString);
    };

    showAlert(
      'Change Attendance Status',
      `Change status for ${course.name} on ${date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}.`,
      [
        {
          text: 'Present',
          onPress: () => handleAttendanceChange('present'),
        },
        {
          text: 'Absent',
          onPress: () => handleAttendanceChange('absent'),
        },
        {
          text: 'Cancelled',
          onPress: () => handleAttendanceChange('cancelled'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return {
    handleSelectClass,
  };
};
