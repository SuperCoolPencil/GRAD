export interface AttendanceRecord {
    id: string;
    data: string;
    Status: 'present' | 'absent' | 'cancelled';
    isExtraClass: boolean;
    scheduleItemId?: string;
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
    requiredAttendance: number;
    presents: number;
    absents: number;
    cancelled: number;
    weeklySchedule?: ScheduleItem[];
    extraClasses?: ExtraClass[];
    attendanceRecords?: AttendanceRecord[];
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
  }
