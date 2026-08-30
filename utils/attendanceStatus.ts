import { AttendanceCountField, AttendanceCounts, AttendanceStatus } from '@/types';

export const DEFAULT_ATTENDANCE_STATUS: AttendanceStatus = 'absent';

const STATUS_COUNT_FIELD: Record<AttendanceStatus, AttendanceCountField> = {
  present: 'presents',
  absent: 'absents',
  cancelled: 'cancelled',
};

export const isAttendanceStatus = (value: unknown): value is AttendanceStatus =>
  value === 'present' || value === 'absent' || value === 'cancelled';

export const getDefaultAttendanceStatus = (value: unknown): AttendanceStatus =>
  isAttendanceStatus(value) ? value : DEFAULT_ATTENDANCE_STATUS;

export const getAttendanceCountField = (status: AttendanceStatus): AttendanceCountField =>
  STATUS_COUNT_FIELD[status];

export const emptyAttendanceCounts = (): AttendanceCounts => ({
  presents: 0,
  absents: 0,
  cancelled: 0,
});

export const addAttendanceStatusToCounts = (
  counts: AttendanceCounts,
  status: AttendanceStatus,
): void => {
  counts[getAttendanceCountField(status)] += 1;
};

export type AutomaticAttendanceDecision =
  | { action: 'skip'; reason: 'holiday' }
  | { action: 'record'; status: AttendanceStatus; reason: 'skip-day' | 'default' };

/**
 * Decides the status for a class the app is filling in automatically.
 * A holiday takes precedence over a planned skip: no class is recorded on a holiday.
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
  if (isHoliday) return { action: 'skip', reason: 'holiday' };
  if (isSkipDay) return { action: 'record', status: 'absent', reason: 'skip-day' };
  return { action: 'record', status: defaultStatus, reason: 'default' };
};
