jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(),
    getAllSync: jest.fn(),
    runSync: jest.fn(),
    prepareSync: jest.fn(),
    withTransactionSync: jest.fn((callback: () => void) => callback()),
    closeSync: jest.fn(),
  })),
}));

import { bulkAddAttendanceRecords, db, deleteAttendanceOccurrence, upsertAttendanceRecord } from '../database';

const mockDatabase = db as jest.Mocked<typeof db>;

const storedRecord = {
  id: 'CS101-schedule-2026-08-31',
  course_id: 'CS101',
  class_date: '2026-08-31',
  status: 'present',
  is_extra_class: 0,
  schedule_item_id: 'schedule',
  time_start: '09:00',
  time_end: '10:00',
};

const attendanceRecord = {
  id: storedRecord.id,
  course_id: storedRecord.course_id,
  date: storedRecord.class_date,
  status: 'present' as const,
  isExtraClass: false,
  scheduleItemId: storedRecord.schedule_item_id,
  timeStart: storedRecord.time_start,
  timeEnd: storedRecord.time_end,
};

describe('attendance persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.withTransactionSync.mockImplementation((callback: () => void) => callback());
  });

  it('inserts a new occurrence and increments its status count atomically', () => {
    mockDatabase.getFirstSync.mockReturnValue(null);

    const result = upsertAttendanceRecord(attendanceRecord);

    expect(result).toEqual({ record: attendanceRecord, previousStatus: null, changed: true });
    expect(mockDatabase.runSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO attendance_records'),
      attendanceRecord.id,
      attendanceRecord.course_id,
      attendanceRecord.date,
      attendanceRecord.status,
      0,
      attendanceRecord.scheduleItemId,
      attendanceRecord.timeStart,
      attendanceRecord.timeEnd,
    );
    expect(mockDatabase.runSync).toHaveBeenNthCalledWith(
      2,
      'UPDATE courses SET presents = MAX(0, presents + ?) WHERE id = ?',
      1,
      attendanceRecord.course_id,
    );
  });

  it('does nothing when an occurrence already has the requested status', () => {
    mockDatabase.getFirstSync.mockReturnValue(storedRecord);

    const result = upsertAttendanceRecord(attendanceRecord);

    expect(result.changed).toBe(false);
    expect(mockDatabase.runSync).not.toHaveBeenCalled();
  });

  it('moves one count when changing an existing occurrence status', () => {
    mockDatabase.getFirstSync.mockReturnValue(storedRecord);

    const result = upsertAttendanceRecord({ ...attendanceRecord, status: 'absent' });

    expect(result.previousStatus).toBe('present');
    expect(result.record.status).toBe('absent');
    expect(mockDatabase.runSync).toHaveBeenNthCalledWith(
      2,
      'UPDATE courses SET presents = MAX(0, presents + ?) WHERE id = ?',
      -1,
      attendanceRecord.course_id,
    );
    expect(mockDatabase.runSync).toHaveBeenNthCalledWith(
      3,
      'UPDATE courses SET absents = MAX(0, absents + ?) WHERE id = ?',
      1,
      attendanceRecord.course_id,
    );
  });

  it('deletes by occurrence identity and decrements the stored status', () => {
    mockDatabase.getFirstSync.mockReturnValue(storedRecord);

    const result = deleteAttendanceOccurrence('CS101', '2026-08-31', '09:00', '10:00', false);

    expect(result).toEqual(attendanceRecord);
    expect(mockDatabase.runSync).toHaveBeenNthCalledWith(1, 'DELETE FROM attendance_records WHERE id = ?', storedRecord.id);
    expect(mockDatabase.runSync).toHaveBeenNthCalledWith(
      2,
      'UPDATE courses SET presents = MAX(0, presents + ?) WHERE id = ?',
      -1,
      attendanceRecord.course_id,
    );
  });

  it('derives bulk counter changes from the records being inserted', () => {
    const insertStatement = { executeSync: jest.fn(), finalizeSync: jest.fn() };
    const countStatement = { executeSync: jest.fn(), finalizeSync: jest.fn() };
    mockDatabase.prepareSync
      .mockReturnValueOnce(insertStatement as any)
      .mockReturnValueOnce(countStatement as any);

    bulkAddAttendanceRecords([
      attendanceRecord,
      { ...attendanceRecord, id: 'second', date: '2026-09-01', status: 'absent' },
    ]);

    expect(insertStatement.executeSync).toHaveBeenCalledTimes(2);
    expect(countStatement.executeSync).toHaveBeenCalledWith(1, 1, 0, 'CS101');
    expect(insertStatement.finalizeSync).toHaveBeenCalled();
    expect(countStatement.finalizeSync).toHaveBeenCalled();
  });
});
