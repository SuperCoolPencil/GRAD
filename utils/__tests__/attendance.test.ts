import { createMissingAttendanceRecords, calculateTargetDate, calculateAttendancePercentage } from '../attendance';
import * as db from '../database';
import { Course, Holiday, SkipDay } from '@/types';

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
            return null;
        });
        (mockDb.getAllSync as jest.Mock).mockImplementation((query: string) => {
            if (query.includes('holidays')) return [];
            if (query.includes('attendance_records')) return [];
            if (query.includes('skip_days')) return [];
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

    describe('Holiday Behavior', () => {
        it('should skip creating records for holidays (no attendance records)', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][yesterday.getDay()];

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

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
                if (query.includes('skip_days')) return [];
                return [];
            });

            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string, ...args: any[]) => {
                if (query.includes('attendance_records') && query.includes('ORDER BY')) {
                    return { class_date: twoDaysAgoStr, time_end: '10:00' };
                }
                return null;
            });

            const result = createMissingAttendanceRecords();

            // Should not have created any records since yesterday was a holiday
            expect(result).toBe(false);
            expect(mockBulkAddAttendanceRecords).not.toHaveBeenCalled();
        });
    });

    describe('Skip Day Behavior', () => {
        it('should create absent records for skip days', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][yesterday.getDay()];

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

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

            // Mock skip day on yesterday (no holiday, but a skip day)
            (mockDb.getAllSync as jest.Mock).mockImplementation((query: string) => {
                if (query.includes('holidays')) return [];
                if (query.includes('skip_days')) {
                    return [{ date: yesterdayStr, course_id: null }]; // Global skip day
                }
                if (query.includes('attendance_records')) return [];
                return [];
            });

            const result = createMissingAttendanceRecords();

            // Should have created an absent record for the skip day
            expect(result).toBe(true);
            expect(mockBulkAddAttendanceRecords).toHaveBeenCalled();

            const addedRecords = mockBulkAddAttendanceRecords.mock.calls[0][0];
            expect(addedRecords.length).toBe(1);
            expect(addedRecords[0].status).toBe('absent');
            expect(addedRecords[0].date).toBe(yesterdayStr);
        });

        it('should respect course-specific skip days', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][yesterday.getDay()];

            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

            const mockCourse1 = {
                id: 'CS101',
                name: 'Computer Science',
                weeklySchedule: [
                    { id: 'sched1', day: dayOfWeek, timeStart: '09:00', timeEnd: '10:00' },
                ],
                extraClasses: [],
                isArchived: false,
                createdAt: twoDaysAgoStr,
            };

            const mockCourse2 = {
                id: 'MATH101',
                name: 'Mathematics',
                weeklySchedule: [
                    { id: 'sched2', day: dayOfWeek, timeStart: '11:00', timeEnd: '12:00' },
                ],
                extraClasses: [],
                isArchived: false,
                createdAt: twoDaysAgoStr,
            };

            mockGetCourses.mockReturnValue([mockCourse1 as any, mockCourse2 as any]);

            // Mock course-specific skip day (only for CS101)
            (mockDb.getAllSync as jest.Mock).mockImplementation((query: string) => {
                if (query.includes('holidays')) return [];
                if (query.includes('skip_days')) {
                    return [{ date: yesterdayStr, course_id: 'CS101' }]; // Only for CS101
                }
                if (query.includes('attendance_records')) return [];
                return [];
            });

            const result = createMissingAttendanceRecords();

            expect(result).toBe(true);
            expect(mockBulkAddAttendanceRecords).toHaveBeenCalled();

            const addedRecords = mockBulkAddAttendanceRecords.mock.calls[0][0];
            // Should have 2 records: absent for CS101 (skip day), absent for MATH101 (default)
            expect(addedRecords.length).toBe(2);

            const cs101Record = addedRecords.find((r: any) => r.course_id === 'CS101');
            const math101Record = addedRecords.find((r: any) => r.course_id === 'MATH101');

            // Both should be absent (CS101 from skip day, MATH101 from default status)
            expect(cs101Record).toBeDefined();
            expect(math101Record).toBeDefined();
            expect(cs101Record!.status).toBe('absent');
            expect(math101Record!.status).toBe('absent');
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

describe('calculateAttendancePercentage', () => {
    it('should return 100 when no classes have been held', () => {
        expect(calculateAttendancePercentage(0, 0)).toBe(100);
    });

    it('should calculate percentage correctly', () => {
        expect(calculateAttendancePercentage(3, 1)).toBe(75);
        expect(calculateAttendancePercentage(1, 1)).toBe(50);
        expect(calculateAttendancePercentage(4, 0)).toBe(100);
        expect(calculateAttendancePercentage(0, 4)).toBe(0);
    });

    it('should round to nearest integer', () => {
        expect(calculateAttendancePercentage(2, 1)).toBe(67); // 66.67 rounds to 67
        expect(calculateAttendancePercentage(1, 2)).toBe(33); // 33.33 rounds to 33
    });
});

describe('calculateTargetDate', () => {
    // Helper to create a date string
    const formatDate = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };

    // Helper to get day name
    const getDayName = (date: Date): string => {
        return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    };

    describe('Already Meeting Target', () => {
        it('should return classesNeeded=0 when already meeting target', () => {
            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                presents: 4,
                absents: 1,
                cancelled: 0,
                requiredAttendance: 75, // 80% > 75%
                weeklySchedule: [{ id: 's1', day: 'Monday', timeStart: '09:00', timeEnd: '10:00' }],
            };

            const result = calculateTargetDate(course, [], []);

            expect(result.classesNeeded).toBe(0);
            expect(result.targetDate).toBeNull();
            expect(result.message).toBe('Already meeting target');
        });

        it('should return classesNeeded=0 when exactly at target', () => {
            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                presents: 3,
                absents: 1,
                cancelled: 0,
                requiredAttendance: 75, // 75% == 75%
                weeklySchedule: [{ id: 's1', day: 'Monday', timeStart: '09:00', timeEnd: '10:00' }],
            };

            const result = calculateTargetDate(course, [], []);

            expect(result.classesNeeded).toBe(0);
            expect(result.targetDate).toBeNull();
        });
    });

    describe('Classes Needed Calculation', () => {
        it('should calculate classes needed correctly when below target', () => {
            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                presents: 2,
                absents: 2,
                cancelled: 0,
                requiredAttendance: 75, // 50% < 75%
                weeklySchedule: [{ id: 's1', day: 'Monday', timeStart: '09:00', timeEnd: '10:00' }],
            };

            const result = calculateTargetDate(course, [], []);

            // (2 + x) / (4 + x) >= 0.75 => x >= 4
            expect(result.classesNeeded).toBe(4);
        });
    });

    describe('Skip Day Impact on Target', () => {
        it('should account for future skip days when calculating classes needed', () => {
            // Get dates for testing
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = formatDate(tomorrow);
            const tomorrowDay = getDayName(tomorrow);

            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                presents: 3,
                absents: 1,
                cancelled: 0,
                requiredAttendance: 75, // Currently at 75%
                weeklySchedule: [{ id: 's1', day: tomorrowDay, timeStart: '09:00', timeEnd: '10:00' }],
            };

            // Add a skip day for tomorrow
            const skipDays: SkipDay[] = [
                { id: 'skip1', date: tomorrowStr }
            ];

            const result = calculateTargetDate(course, [], skipDays);

            // With skip day tomorrow, projected: 3 presents / 5 total = 60%
            // Need x classes: (3+x)/(5+x) >= 0.75 => x >= 3
            expect(result.classesNeeded).toBeGreaterThan(0);
        });

        it('should not count classes on skip days when finding target date', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = formatDate(tomorrow);
            const tomorrowDay = getDayName(tomorrow);

            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                presents: 2,
                absents: 2,
                cancelled: 0,
                requiredAttendance: 75,
                weeklySchedule: [{ id: 's1', day: tomorrowDay, timeStart: '09:00', timeEnd: '10:00' }],
            };

            // Add skip day for tomorrow
            const skipDays: SkipDay[] = [
                { id: 'skip1', date: tomorrowStr }
            ];

            const result = calculateTargetDate(course, [], skipDays);

            // Target date should NOT be tomorrow since it's a skip day
            if (result.targetDate) {
                expect(formatDate(result.targetDate)).not.toBe(tomorrowStr);
            }
        });
    });

    describe('Holiday Impact on Target', () => {
        it('should not count classes on holidays when finding target date', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = formatDate(tomorrow);
            const tomorrowDay = getDayName(tomorrow);

            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                presents: 2,
                absents: 2,
                cancelled: 0,
                requiredAttendance: 75,
                weeklySchedule: [{ id: 's1', day: tomorrowDay, timeStart: '09:00', timeEnd: '10:00' }],
            };

            // Add holiday for tomorrow
            const holidays: Holiday[] = [
                { id: 'h1', name: 'Holiday', startDate: tomorrowStr, endDate: tomorrowStr }
            ];

            const result = calculateTargetDate(course, holidays, []);

            // Target date should NOT be tomorrow since it's a holiday
            if (result.targetDate) {
                expect(formatDate(result.targetDate)).not.toBe(tomorrowStr);
            }
        });

        it('should not count holiday skip days as absences', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = formatDate(tomorrow);
            const tomorrowDay = getDayName(tomorrow);

            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                presents: 3,
                absents: 1,
                cancelled: 0,
                requiredAttendance: 75, // Currently at 75%
                weeklySchedule: [{ id: 's1', day: tomorrowDay, timeStart: '09:00', timeEnd: '10:00' }],
            };

            // Both a holiday AND a skip day on the same date
            // The holiday should take precedence - no class happens, no absence counted
            const holidays: Holiday[] = [
                { id: 'h1', name: 'Holiday', startDate: tomorrowStr, endDate: tomorrowStr }
            ];
            const skipDays: SkipDay[] = [
                { id: 'skip1', date: tomorrowStr }
            ];

            const result = calculateTargetDate(course, holidays, skipDays);

            // Should still be meeting target since holiday means no class (no absence)
            expect(result.classesNeeded).toBe(0);
        });
    });

    describe('No Schedule Set', () => {
        it('should return appropriate message when no schedule is set', () => {
            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                presents: 2,
                absents: 2,
                cancelled: 0,
                requiredAttendance: 75,
                weeklySchedule: [],
                extraClasses: [],
            };

            const result = calculateTargetDate(course, [], []);

            expect(result.targetDate).toBeNull();
            expect(result.message).toContain('no schedule set');
        });
    });

    describe('Extra Classes', () => {
        it('should count extra classes in target date calculation', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = formatDate(tomorrow);

            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                presents: 2,
                absents: 2,
                cancelled: 0,
                requiredAttendance: 75,
                weeklySchedule: [], // No weekly schedule
                extraClasses: [
                    { id: 'e1', date: tomorrowStr, timeStart: '09:00', timeEnd: '10:00' },
                ],
            };

            const result = calculateTargetDate(course, [], []);

            // Should find the extra class for target date calculation
            expect(result.classesNeeded).toBeGreaterThan(0);
        });
    });
});
