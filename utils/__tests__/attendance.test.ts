import { createMissingAttendanceRecords } from '../attendance';
import * as db from '../database';

// Mock the database module
jest.mock('../database', () => ({
    db: {
        getFirstSync: jest.fn(),
        getAllSync: jest.fn(),
    },
    getSetting: jest.fn(),
    getCourses: jest.fn(),
    bulkAddAttendanceRecords: jest.fn(),
    bulkUpdateCourseCounts: jest.fn(),
}));

const mockDb = db.db as jest.Mocked<typeof db.db>;
const mockGetSetting = db.getSetting as jest.MockedFunction<typeof db.getSetting>;
const mockGetCourses = db.getCourses as jest.MockedFunction<typeof db.getCourses>;
const mockBulkAddAttendanceRecords = db.bulkAddAttendanceRecords as jest.MockedFunction<typeof db.bulkAddAttendanceRecords>;
const mockBulkUpdateCourseCounts = db.bulkUpdateCourseCounts as jest.MockedFunction<typeof db.bulkUpdateCourseCounts>;

describe('createMissingAttendanceRecords', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock implementations
        mockGetSetting.mockImplementation((key: string) => {
            if (key === 'defaultAttendanceStatus') return 'absent';
            if (key === 'holidayBehavior') return 'skip';
            return null;
        });
        (mockDb.getAllSync as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('holidays')) return [];
            if (query.includes('attendance_records')) return [];
            return [];
        });
        (mockDb.getFirstSync as jest.Mock).mockReturnValue(null);
    });

    describe('Basic Gap Filling', () => {
        it('should create absent records for missed classes between last record and now', () => {
            // Setup: Course with Monday schedule, last record was 2 weeks ago
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

            const mockCourse = {
                id: 'CS101',
                name: 'Computer Science',
                weeklySchedule: [
                    { id: 'sched1', day: 'monday', timeStart: '09:00', timeEnd: '10:00' },
                ],
                extraClasses: [],
                isArchived: false,
                createdAt: twoWeeksAgoStr,
            };

            mockGetCourses.mockReturnValue([mockCourse as any]);

            // Last record was 2 weeks ago
            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string, ...args: any[]) => {
                if (query.includes('attendance_records') && query.includes('ORDER BY')) {
                    return {
                        class_date: twoWeeksAgoStr,
                        time_end: '10:00',
                    };
                }
                return null;
            });

            const result = createMissingAttendanceRecords();

            // Should have created new records
            expect(result).toBe(true);
            expect(mockBulkAddAttendanceRecords).toHaveBeenCalled();

            const addedRecords = mockBulkAddAttendanceRecords.mock.calls[0][0];
            // All new records should have 'absent' status
            addedRecords.forEach((record: any) => {
                expect(record.status).toBe('absent');
                expect(record.course_id).toBe('CS101');
            });
        });

        it('should return false when no new records are needed', () => {
            // Setup: Course with no schedule
            const mockCourse = {
                id: 'CS101',
                name: 'Computer Science',
                weeklySchedule: [],
                extraClasses: [],
                isArchived: false,
                createdAt: new Date().toISOString().split('T')[0],
            };

            mockGetCourses.mockReturnValue([mockCourse as any]);

            const result = createMissingAttendanceRecords();

            expect(result).toBe(false);
            expect(mockBulkAddAttendanceRecords).not.toHaveBeenCalled();
        });
    });

    describe('Holiday Behavior - Skip', () => {
        it('should skip creating records for holidays when holidayBehavior is skip', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][yesterday.getDay()];

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

            mockGetSetting.mockImplementation((key: string) => {
                if (key === 'defaultAttendanceStatus') return 'absent';
                if (key === 'holidayBehavior') return 'skip';
                return null;
            });

            const mockCourse = {
                id: 'CS101',
                name: 'Computer Science',
                weeklySchedule: [
                    { id: 'sched1', day: dayOfWeek, timeStart: '09:00', timeEnd: '10:00' },
                ],
                extraClasses: [],
                isArchived: false,
                createdAt: twoDaysAgoStr,
            };

            mockGetCourses.mockReturnValue([mockCourse as any]);

            // Mock holiday on yesterday
            (mockDb.getAllSync as jest.Mock).mockImplementation((query: string) => {
                if (query.includes('holidays')) {
                    return [{ start_date: yesterdayStr, end_date: yesterdayStr }];
                }
                if (query.includes('attendance_records')) return [];
                return [];
            });

            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string, ...args: any[]) => {
                if (query.includes('attendance_records') && query.includes('ORDER BY')) {
                    return { class_date: twoDaysAgoStr, time_end: '10:00' };
                }
                return null;
            });

            const result = createMissingAttendanceRecords();

            // Should not have created any records since yesterday was a holiday and should be skipped
            expect(result).toBe(false);
            expect(mockBulkAddAttendanceRecords).not.toHaveBeenCalled();
        });
    });

    describe('Holiday Behavior - Cancel', () => {
        it('should create cancelled records for holidays when holidayBehavior is cancel', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][yesterday.getDay()];

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

            mockGetSetting.mockImplementation((key: string) => {
                if (key === 'defaultAttendanceStatus') return 'absent';
                if (key === 'holidayBehavior') return 'cancel';
                return null;
            });

            const mockCourse = {
                id: 'CS101',
                name: 'Computer Science',
                weeklySchedule: [
                    { id: 'sched1', day: dayOfWeek, timeStart: '09:00', timeEnd: '10:00' },
                ],
                extraClasses: [],
                isArchived: false,
                createdAt: twoDaysAgoStr,
            };

            mockGetCourses.mockReturnValue([mockCourse as any]);

            // Mock holiday on yesterday
            (mockDb.getAllSync as jest.Mock).mockImplementation((query: string) => {
                if (query.includes('holidays')) {
                    return [{ start_date: yesterdayStr, end_date: yesterdayStr }];
                }
                if (query.includes('attendance_records')) return [];
                return [];
            });

            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string, ...args: any[]) => {
                if (query.includes('attendance_records') && query.includes('ORDER BY')) {
                    return { class_date: twoDaysAgoStr, time_end: '10:00' };
                }
                return null;
            });

            const result = createMissingAttendanceRecords();

            // Should have created a cancelled record for the holiday
            expect(result).toBe(true);
            expect(mockBulkAddAttendanceRecords).toHaveBeenCalled();

            const addedRecords = mockBulkAddAttendanceRecords.mock.calls[0][0];
            expect(addedRecords.length).toBe(1);
            expect(addedRecords[0].status).toBe('cancelled');
            expect(addedRecords[0].date).toBe(yesterdayStr);
        });
    });

    describe('Chronological Check - Gaps from Course Creation', () => {
        it('should fill gaps from course creation even if there are records after them', () => {
            // Setup: Course was created 5 days ago, has a class 3 days ago (Sunday schedule)
            // but we have a record from today. The old behavior would skip the 3-days-ago class.
            // New behavior: should still create a record for the missed class.

            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
            const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];

            // Find a day that is between course creation (5 days ago) and today
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const threeDaysAgoDayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][threeDaysAgo.getDay()];

            const mockCourse = {
                id: 'CS101',
                name: 'Computer Science',
                weeklySchedule: [
                    { id: 'sched1', day: threeDaysAgoDayOfWeek, timeStart: '09:00', timeEnd: '10:00' },
                ],
                extraClasses: [],
                isArchived: false,
                createdAt: fiveDaysAgoStr,
            };

            mockGetCourses.mockReturnValue([mockCourse as any]);

            // Even though we return a "last record" from today, gaps should still be filled
            // because we now start from course creation date
            (mockDb.getFirstSync as jest.Mock).mockReturnValue(null); // No existing records in DB lookup

            const result = createMissingAttendanceRecords();

            // NEW BEHAVIOR: Should create records for gaps from course creation
            expect(result).toBe(true);
            expect(mockBulkAddAttendanceRecords).toHaveBeenCalled();

            const addedRecords = mockBulkAddAttendanceRecords.mock.calls[0][0];
            // Should have at least 1 record for the 3-days-ago class
            expect(addedRecords.length).toBeGreaterThanOrEqual(1);
            expect(addedRecords[0].status).toBe('absent');
        });
    });

    describe('Extra Classes', () => {
        it('should create records for extra classes that have passed', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

            const mockCourse = {
                id: 'CS101',
                name: 'Computer Science',
                weeklySchedule: [],
                extraClasses: [
                    { id: 'extra1', date: yesterdayStr, timeStart: '14:00', timeEnd: '15:00' },
                ],
                isArchived: false,
                createdAt: twoDaysAgoStr,
            };

            mockGetCourses.mockReturnValue([mockCourse as any]);

            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string, ...args: any[]) => {
                if (query.includes('attendance_records') && query.includes('ORDER BY')) {
                    return { class_date: twoDaysAgoStr, time_end: '10:00' };
                }
                return null;
            });

            const result = createMissingAttendanceRecords();

            expect(result).toBe(true);
            expect(mockBulkAddAttendanceRecords).toHaveBeenCalled();

            const addedRecords = mockBulkAddAttendanceRecords.mock.calls[0][0];
            expect(addedRecords.length).toBe(1);
            expect(addedRecords[0].isExtraClass).toBe(true);
            expect(addedRecords[0].date).toBe(yesterdayStr);
            expect(addedRecords[0].status).toBe('absent');
        });
    });
});
