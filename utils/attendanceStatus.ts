import { AttendanceCountField, AttendanceStatus } from '@/types';

export const DEFAULT_ATTENDANCE_STATUS: AttendanceStatus = 'absent';

const STATUS_COUNT_FIELD: Partial<Record<AttendanceStatus, AttendanceCountField>> = {
  present: 'presents',
  absent: 'absents',
  cancelled: 'cancelled',
  skipped: 'absents',
};

export const isAttendanceStatus = (value: unknown): value is AttendanceStatus =>
  value === 'present' || value === 'absent' || value === 'cancelled' || value === 'holiday' || value === 'skipped';

export const getDefaultAttendanceStatus = (value: unknown): AttendanceStatus =>
  value === 'present' || value === 'absent' || value === 'cancelled'
    ? value
    : DEFAULT_ATTENDANCE_STATUS;

export const getAttendanceCountField = (status: AttendanceStatus): AttendanceCountField | undefined =>
  STATUS_COUNT_FIELD[status];

export type AutomaticAttendanceDecision =
  | { action: 'record'; status: AttendanceStatus; reason: 'holiday' | 'skip-day' | 'default' };

/**
 * Decides the status for a class the app is filling in automatically.
 * A holiday takes precedence over a planned skip. Holiday records are
 * informational; skipped records continue to count as absences.
 */
export const decideAutomaticAttendance = ({
  isHoliday,
  isSkipDay,
  defaultStatus,
}: {
  isHoliday: boolean;
  isSkipDay: boolean;
  defaultStatus: AttendanceStatus;
}): AutomaticAttendanceDecision => {
  if (isHoliday) return { action: 'record', status: 'holiday', reason: 'holiday' };
  if (isSkipDay) return { action: 'record', status: 'skipped', reason: 'skip-day' };
  return { action: 'record', status: defaultStatus, reason: 'default' };
};
