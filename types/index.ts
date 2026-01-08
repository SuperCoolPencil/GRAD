export interface AttendanceRecord {
  id: string;
  course_id: string;
  date: string;
  status: 'present' | 'absent' | 'cancelled';
  isExtraClass: boolean;
  scheduleItemId?: string;
  timeStart: string;
  timeEnd: string;
}

export interface Holiday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface ScheduleItem {
  id: string;
  day: string;
  timeStart: string;
  timeEnd: string;
}

export interface ExtraClass {
  id: string;
  date: string;
  timeStart: string;
  timeEnd: string;
}

export interface Course {
  id: string;
  name: string;
  color?: string;
  requiredAttendance: number;
  presents: number;
  absents: number;
  cancelled: number;
  weeklySchedule?: ScheduleItem[];
  extraClasses?: ExtraClass[];
  attendanceRecords?: AttendanceRecord[];
  attendancePercentage?: number;
  showInTracker?: boolean | number;
  showInHeatmap?: boolean | number;
  showInRadar?: boolean | number;
  isArchived?: boolean;
  createdAt?: string;
  archivedAt?: string;
}

export interface ClassItem {
  id: string;
  courseId: string;
  courseName: string;
  timeStart: string;
  timeEnd: string;
  isExtraClass: boolean;
  requiredAttendance: number;
  currentAttendance: number;
  needToAttend: number;
  workMarked?: string;
  status?: 'present' | 'absent' | 'cancelled';
}

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  shouldCloseAlert?: boolean;
}

export interface Settings {
  theme: 'light' | 'dark';
  notificationTime: number;
  notificationsEnabled: boolean;
  is24Hour: boolean;
  defaultAttendanceStatus: 'present' | 'absent' | 'cancelled';
  holidayBehavior: 'skip' | 'cancel';
}

export type NotificationAnchor = 'before_start' | 'after_start' | 'after_end';

export interface NotificationTiming {
  value: number;
  anchor: NotificationAnchor;
}
