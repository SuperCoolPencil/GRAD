import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Course, NotificationTiming } from '../../types';

import {
    scheduleCourseNotifications,
    cancelCourseNotifications,
    handleNotificationAttendanceAction,
    setupNotificationChannels,
    scheduleBackupReminder,
    cancelBackupReminder,
} from '../notifications';
import * as db from '../database';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
    getAllScheduledNotificationsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    cancelAllScheduledNotificationsAsync: jest.fn(),
    dismissNotificationAsync: jest.fn(),
    setNotificationCategoryAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    registerTaskAsync: jest.fn(),
    SchedulableTriggerInputTypes: {
        WEEKLY: 'weekly',
        DATE: 'date',
        TIME_INTERVAL: 'timeInterval',
    },
    AndroidImportance: {
        HIGH: 4,
    },
}));

jest.mock('expo-task-manager', () => ({
    defineTask: jest.fn(),
    isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
}));

// Mock database
jest.mock('../database', () => ({
    db: {
        getFirstSync: jest.fn(),
    },
    getCourseById: jest.fn(),
    upsertAttendanceRecord: jest.fn(),
}));

// Mock attendance
jest.mock('../attendance', () => ({
    calculateAttendancePercentage: jest.fn().mockReturnValue(75),
    getAttendanceDelta: jest.fn().mockReturnValue(-1),
    isClassSkippedBySkipDay: jest.fn().mockReturnValue(false),
}));

const mockDb = db.db as jest.Mocked<typeof db.db>;
const mockGetAllScheduled = Notifications.getAllScheduledNotificationsAsync as jest.MockedFunction<typeof Notifications.getAllScheduledNotificationsAsync>;
const mockScheduleNotification = Notifications.scheduleNotificationAsync as jest.MockedFunction<typeof Notifications.scheduleNotificationAsync>;
const mockCancelScheduled = Notifications.cancelScheduledNotificationAsync as jest.MockedFunction<typeof Notifications.cancelScheduledNotificationAsync>;

describe('notifications', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAllScheduled.mockResolvedValue([]);
        mockScheduleNotification.mockResolvedValue('test-id');
        (mockDb.getFirstSync as jest.Mock).mockReturnValue(null);
    });

    describe('scheduleCourseNotifications', () => {
        const baseCourse: Course = {
            id: 'CS101',
            name: 'Computer Science',
            requiredAttendance: 75,
            presents: 10,
            absents: 2,
            cancelled: 0,
            weeklySchedule: [
                { id: 'sched1', day: 'Monday', timeStart: '09:00', timeEnd: '10:00' },
            ],
            extraClasses: [],
        };

        it('should schedule notifications for weekly classes with before_start anchor', async () => {
            const timing: NotificationTiming = { value: 15, anchor: 'before_start' };

            await scheduleCourseNotifications(baseCourse, timing);

            expect(mockScheduleNotification).toHaveBeenCalled();
            const call = mockScheduleNotification.mock.calls[0][0];
            expect(call.identifier).toBe('CS101-sched1');
            expect(call.trigger).toMatchObject({
                type: 'weekly',
            });
        });

        it('should schedule notifications for weekly classes with after_start anchor', async () => {
            const timing: NotificationTiming = { value: 10, anchor: 'after_start' };

            await scheduleCourseNotifications(baseCourse, timing);

            expect(mockScheduleNotification).toHaveBeenCalled();
            const call = mockScheduleNotification.mock.calls[0][0];
            expect(call.identifier).toBe('CS101-sched1');
        });

        it('should schedule notifications for weekly classes with after_end anchor', async () => {
            const timing: NotificationTiming = { value: 5, anchor: 'after_end' };

            await scheduleCourseNotifications(baseCourse, timing);

            expect(mockScheduleNotification).toHaveBeenCalled();
            const call = mockScheduleNotification.mock.calls[0][0];
            expect(call.identifier).toBe('CS101-sched1');
        });

        it('should skip notification if class is on a holiday', async () => {
            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string) => {
                if (query.includes('holidays')) {
                    return { id: 'holiday1' }; // Holiday exists
                }
                return null;
            });

            const timing: NotificationTiming = { value: 15, anchor: 'before_start' };
            await scheduleCourseNotifications(baseCourse, timing);

            // Should cancel existing but not schedule new
            expect(mockCancelScheduled).not.toHaveBeenCalled(); // No existing to cancel
            // Since holiday, no new notification should be scheduled
            expect(mockScheduleNotification).not.toHaveBeenCalled();
        });

        it('should skip a class planned as a bunk', async () => {
            const { isClassSkippedBySkipDay } = jest.requireMock('../attendance');
            isClassSkippedBySkipDay.mockReturnValueOnce(true);

            await scheduleCourseNotifications(baseCourse, { value: 15, anchor: 'before_start' }, [{
                id: 'skip-1', date: '2099-01-01', courseId: 'CS101', timeStart: '09:00', timeEnd: '10:00',
            }]);

            expect(mockScheduleNotification).not.toHaveBeenCalled();
        });

        it('should schedule a weekly class already marked present for its next occurrence', async () => {
            const nextClass = new Date(Date.now() + 2 * 60 * 60 * 1000);
            const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextClass.getDay()];
            const timeStart = `${String(nextClass.getHours()).padStart(2, '0')}:${String(nextClass.getMinutes()).padStart(2, '0')}`;
            const course = { ...baseCourse, weeklySchedule: [{ id: 'sched1', day, timeStart, timeEnd: '23:59' }] };
            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string) => query.includes('attendance_records') ? { status: 'present' } : null);

            await scheduleCourseNotifications(course, { value: 15, anchor: 'before_start' });

            expect(mockScheduleNotification).toHaveBeenCalled();
            expect(mockScheduleNotification.mock.calls[0][0].content.title).toBe('Computer Science - 82%');
        });

        it('should skip a cancelled weekly class for its next occurrence', async () => {
            const nextClass = new Date(Date.now() + 2 * 60 * 60 * 1000);
            const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextClass.getDay()];
            const timeStart = `${String(nextClass.getHours()).padStart(2, '0')}:${String(nextClass.getMinutes()).padStart(2, '0')}`;
            const course = { ...baseCourse, weeklySchedule: [{ id: 'sched1', day, timeStart, timeEnd: '23:59' }] };
            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string) => query.includes('attendance_records') ? { status: 'cancelled' } : null);

            await scheduleCourseNotifications(course, { value: 15, anchor: 'before_start' });

            expect(mockScheduleNotification).not.toHaveBeenCalled();
        });

        it('should not schedule duplicate notifications', async () => {
            mockGetAllScheduled.mockResolvedValue([
                { identifier: 'CS101-sched1' } as any,
            ]);

            const timing: NotificationTiming = { value: 15, anchor: 'before_start' };
            await scheduleCourseNotifications(baseCourse, timing);

            // Should not schedule since it already exists
            expect(mockScheduleNotification).not.toHaveBeenCalled();
        });
    });

    describe('scheduleCourseNotifications with extra classes', () => {
        it('should schedule notifications for extra classes', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                requiredAttendance: 75,
                presents: 10,
                absents: 2,
                cancelled: 0,
                weeklySchedule: [],
                extraClasses: [
                    { id: 'extra1', date: tomorrowStr, timeStart: '14:00', timeEnd: '15:00' },
                ],
            };

            const timing: NotificationTiming = { value: 15, anchor: 'before_start' };
            await scheduleCourseNotifications(course, timing);

            expect(mockScheduleNotification).toHaveBeenCalled();
            const call = mockScheduleNotification.mock.calls[0][0];
            expect(call.identifier).toBe('CS101-extra1');
        });

        it('should schedule an extra class notification when attendance is already recorded', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string) => {
                if (query.includes('attendance_records')) {
                    return { status: 'absent' };
                }
                return null;
            });

            const course: Course = {
                id: 'CS101',
                name: 'Computer Science',
                requiredAttendance: 75,
                presents: 10,
                absents: 2,
                cancelled: 0,
                weeklySchedule: [],
                extraClasses: [
                    { id: 'extra1', date: tomorrowStr, timeStart: '14:00', timeEnd: '15:00' },
                ],
            };

            const timing: NotificationTiming = { value: 15, anchor: 'before_start' };
            await scheduleCourseNotifications(course, timing);

            expect(mockScheduleNotification).toHaveBeenCalled();
            expect(mockScheduleNotification.mock.calls[0][0].content.title).toBe('Computer Science - 91%');
        });

        it('should skip an extra class notification when it is cancelled', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            (mockDb.getFirstSync as jest.Mock).mockImplementation((query: string) =>
                query.includes('attendance_records') ? { status: 'cancelled' } : null,
            );

            const course: Course = {
                id: 'CS101', name: 'Computer Science', requiredAttendance: 75,
                presents: 10, absents: 2, cancelled: 0, weeklySchedule: [],
                extraClasses: [{ id: 'extra1', date: tomorrowStr, timeStart: '14:00', timeEnd: '15:00' }],
            };

            await scheduleCourseNotifications(course, { value: 15, anchor: 'before_start' });

            expect(mockScheduleNotification).not.toHaveBeenCalled();
        });
    });

    describe('cancelCourseNotifications', () => {
        it('should cancel all notifications for a course', async () => {
            mockGetAllScheduled.mockResolvedValue([
                { identifier: 'CS101-sched1' } as any,
                { identifier: 'CS101-sched2' } as any,
                { identifier: 'OTHER-sched1' } as any,
            ]);

            await cancelCourseNotifications('CS101');

            expect(mockCancelScheduled).toHaveBeenCalledTimes(2);
            expect(mockCancelScheduled).toHaveBeenCalledWith('CS101-sched1');
            expect(mockCancelScheduled).toHaveBeenCalledWith('CS101-sched2');
        });
    });

    describe('backup reminders', () => {
        it('schedules a recurring weekly backup reminder', async () => {
            await scheduleBackupReminder();

            expect(mockScheduleNotification).toHaveBeenCalledWith(expect.objectContaining({
                identifier: 'backup-reminder-weekly',
                content: expect.objectContaining({ title: 'Back up your GRAD data' }),
                trigger: expect.objectContaining({ seconds: 60 * 60 * 24 * 7, repeats: true }),
            }));
        });

        it('cancels the recurring backup reminder', async () => {
            await cancelBackupReminder();

            expect(mockCancelScheduled).toHaveBeenCalledWith('backup-reminder-weekly');
        });
    });

    describe('handleNotificationAttendanceAction', () => {
        const course: Course = {
            id: 'CS101',
            name: 'Computer Science',
            requiredAttendance: 75,
            presents: 10,
            absents: 2,
            cancelled: 0,
            weeklySchedule: [{ id: 'sched1', day: 'Monday', timeStart: '09:00', timeEnd: '10:00' }],
            extraClasses: [],
        };

        it('uses the shared attendance upsert for notification actions', async () => {
            (db.getCourseById as jest.Mock).mockReturnValue(course);

            await handleNotificationAttendanceAction('CS101', 'sched1', 'present', 'notification-1', '2026-08-31');

            expect(db.upsertAttendanceRecord).toHaveBeenCalledWith({
                id: 'CS101-sched1-2026-08-31',
                course_id: 'CS101',
                date: '2026-08-31',
                status: 'present',
                isExtraClass: false,
                scheduleItemId: 'sched1',
                timeStart: '09:00',
                timeEnd: '10:00',
            });
            expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notification-1');
        });

        it('does not create malformed attendance for a removed schedule', async () => {
            (db.getCourseById as jest.Mock).mockReturnValue(course);

            await handleNotificationAttendanceAction('CS101', 'removed', 'present', 'notification-2', '2026-08-31');

            expect(db.upsertAttendanceRecord).not.toHaveBeenCalled();
            expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('notification-2');
        });
    });

    describe('setupNotificationChannels', () => {
        it('should set up notification categories', async () => {
            const mockSetCategory = Notifications.setNotificationCategoryAsync as jest.MockedFunction<typeof Notifications.setNotificationCategoryAsync>;

            await setupNotificationChannels();

            expect(mockSetCategory).toHaveBeenCalledWith('class-actions', expect.arrayContaining([
                expect.objectContaining({ identifier: 'present', options: { opensAppToForeground: Platform.OS === 'ios' } }),
                expect.objectContaining({ identifier: 'absent' }),
                expect.objectContaining({ identifier: 'cancelled' }),
            ]));
        });
    });
});
