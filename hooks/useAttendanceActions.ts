import { useContext } from 'react';
import { AppContext } from '@/context/AppContext';
import { AttendanceRecord, Course, ScheduleItem } from '@/types';
import { useCustomAlert } from '@/context/AlertContext';

interface ClassSession extends ScheduleItem {
  isExtraClass: boolean;
  date?: string;
}

export interface ClassItem {
  course: Course;
  schedule: ClassSession;
  attendance?: AttendanceRecord;
}

import { formatDateToISO } from '@/utils/dateHelpers';

export const useAttendanceActions = (refetch: () => void) => {
  const { upsertAttendance } = useContext(AppContext);
  const { showAlert } = useCustomAlert();

  const handleSelectClass = (classItem: ClassItem, date: Date) => {
    const { course, schedule } = classItem;
    const dateString = formatDateToISO(date);

    const handleAttendanceChange = (newStatus: 'present' | 'absent' | 'cancelled') => {
      upsertAttendance(course.id, schedule.id, newStatus, schedule.isExtraClass, schedule.timeStart, schedule.timeEnd, dateString);
      refetch();
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
