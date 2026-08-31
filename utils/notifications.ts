import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { Course, ScheduleItem, ExtraClass, AttendanceRecord, NotificationTiming, SkipDay } from '@/types';
import { db, getCourseById, upsertAttendanceRecord } from './database';
import { formatDateToISO } from './dateHelpers';
import { getAttendanceDelta, isClassSkippedBySkipDay } from './attendance'

const NOTIFICATION_ACTION_TASK = 'grad-notification-attendance-action';

if (Platform.OS !== 'web') {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_ACTION_TASK, async ({ data }) => {
    if (!('actionIdentifier' in data) || data.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const { courseId, scheduleId, occurrenceDate } = data.notification.request.content.data as {
      courseId?: string;
      scheduleId?: string;
      occurrenceDate?: string;
    };
    if (!courseId || !scheduleId) return;

    await handleNotificationAttendanceAction(
      courseId,
      scheduleId,
      data.actionIdentifier as 'present' | 'absent' | 'cancelled',
      data.notification.request.identifier,
      occurrenceDate,
    );
  });
}

// Function to schedule notifications for a single course
export const scheduleCourseNotifications = async (course: Course, timing: NotificationTiming, skipDays: SkipDay[] = []) => {
  console.log(`[NOTIF] Scheduling notifications for course: ${course.name}`);
  // First, cancel any existing notifications for this course to avoid duplicates
  await cancelCourseNotifications(course.id);

  const { weeklySchedule, extraClasses } = course;

  if (weeklySchedule) {
    for (const item of weeklySchedule) {
      await scheduleNotification(course, item, timing, skipDays);
    }
  }

  if (extraClasses) {
    for (const item of extraClasses) {
      await scheduleNotification(course, item, timing, skipDays);
    }
  }
};

export const scheduleUpdateNotification = async (version: string) => {
  console.log(`[NOTIF] Sending immediate + weekly update notification for version: ${version}`);

  // 1. Send immediate notification
  await Notifications.scheduleNotificationAsync({
    identifier: 'app-update-notification-now',
    content: {
      title: 'App Update Available!',
      body: `A new version (${version}) of GRAD is available. Tap to update!`,
      data: { url: 'https://github.com/SuperCoolPencil/GRAD/releases/latest' },
    },
    trigger: null, // fire immediately
  });

  // 2. Schedule weekly reminder
  await Notifications.scheduleNotificationAsync({
    identifier: 'app-update-notification-weekly',
    content: {
      title: 'Reminder: Update Available!',
      body: `Don't forget to update to version ${version} of GRAD.`,
      data: { url: 'https://github.com/SuperCoolPencil/GRAD/releases/latest' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 24 * 7, // 7 days in seconds
      repeats: true,             // repeat weekly
    },
  });
};

export const cancelUpdateNotification = async () => {
  console.log('[NOTIF] Cancelling update notifications');
  await Notifications.cancelScheduledNotificationAsync('app-update-notification-now');
  await Notifications.cancelScheduledNotificationAsync('app-update-notification-weekly');
};

// Function to handle notification attendance actions
export const handleNotificationAttendanceAction = async (
  courseId: string,
  scheduleId: string,
  actionIdentifier: 'present' | 'absent' | 'cancelled',
  notificationIdentifier: string,
  occurrenceDate?: string,
) => {
  console.log(`[NOTIF_HANDLER] Handling action: ${actionIdentifier} for course: ${courseId}, schedule: ${scheduleId}`);

  const course = getCourseById(courseId);
  if (!course) {
    console.log(`[NOTIF_HANDLER] Course not found for ID: ${courseId}`);
    return;
  }

  const scheduleItem = course.weeklySchedule?.find(s => s.id === scheduleId);
  const extraClassItem = course.extraClasses?.find(e => e.id === scheduleId);
  if (!scheduleItem && !extraClassItem) {
    console.log(`[NOTIF_HANDLER] Schedule item not found for ID: ${scheduleId}`);
    await Notifications.dismissNotificationAsync(notificationIdentifier);
    return;
  }

  const isExtraClass = !!extraClassItem;
  const timeStart = scheduleItem?.timeStart || extraClassItem?.timeStart || '';
  const timeEnd = scheduleItem?.timeEnd || extraClassItem?.timeEnd || '';
  const date = extraClassItem?.date || occurrenceDate || formatDateToISO(new Date());
  upsertAttendanceRecord({
    id: `${courseId}-${scheduleId}-${date}`,
    course_id: courseId,
    date,
    status: actionIdentifier,
    isExtraClass,
    scheduleItemId: scheduleId,
    timeStart,
    timeEnd,
  });

  // Dismiss the notification after handling the action
  await Notifications.dismissNotificationAsync(notificationIdentifier);
  console.log(`[NOTIF_HANDLER] Notification ${notificationIdentifier} dismissed.`);

};


// Function to cancel notifications for a single course
export const cancelCourseNotifications = async (courseId: string) => {

  console.log(`[NOTIF] Cancelling notifications for course: ${courseId}`);

  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduledNotifications) {
    if (notification.identifier.startsWith(`${courseId}-`)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
};

// Function to format the notification content
const getNotificationContent = (
  course: Course,
  item: ScheduleItem | ExtraClass,
  occurrenceDate?: string,
  occurrenceStatus?: AttendanceRecord['status'],
) => {
  // A reminder describes the state immediately before this occurrence. If it
  // has already been marked, exclude that mark from its own notification.
  const presents = Math.max(0, (course.presents || 0) - (occurrenceStatus === 'present' ? 1 : 0));
  const absents = Math.max(0, (course.absents || 0) - (occurrenceStatus === 'absent' ? 1 : 0));
  const total = presents + absents;
  const attendancePercentage = total > 0 ? Math.round((presents / total) * 100) : 100;
  const requiredAttendance = course.requiredAttendance ?? 75;

  const attendanceDelta = getAttendanceDelta(presents, absents, requiredAttendance);
  const type = attendanceDelta > 0 ? 'attend' : 'bunk';
  const count = Math.abs(attendanceDelta);
  let deltaMessage: string;

  if (!Number.isFinite(attendanceDelta)) {
    deltaMessage = 'A 100% target is no longer reachable after an absence.';
  } else if (type === 'attend' && count > 0) {
    deltaMessage = `You need to attend ${count} more class(es).`;
  } else {
    deltaMessage = `You can bunk ${count} class(es)!`;
  }

  if (count === 0) {
    deltaMessage = 'You are on track with your attendance!';
  }

  return {
    title: `${course.name} - ${attendancePercentage}%`,
    body: deltaMessage,
    data: { courseId: course.id, scheduleId: item.id, occurrenceDate },
    categoryIdentifier: 'class-actions',
  };
};

const getNextClassDate = (item: ScheduleItem, now: Date): Date => {
  const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(item.day);
  const [h, m] = item.timeStart.split(':').map(Number);

  const nextClass = new Date(now);
  const daysUntil = (dayIndex - nextClass.getDay() + 7) % 7;
  nextClass.setDate(nextClass.getDate() + daysUntil);
  nextClass.setHours(h, m, 0, 0);

  if (nextClass < now) {
    nextClass.setDate(nextClass.getDate() + 7);
  }
  return nextClass;
};

const scheduleNotification = async (
  course: Course,
  item: ScheduleItem | ExtraClass,
  timing: NotificationTiming,
  skipDays: SkipDay[],
) => {
  const identifier = `${course.id}-${item.id}`;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  if (existing.some(n => n.identifier === identifier)) {
    console.log(`[NOTIF] Notification with identifier ${identifier} already exists. Skipping.`);
    return;
  }

  console.log(`[NOTIF] Scheduling notification for course: ${course.name}, item: ${item.id}, timing: ${timing.value} mins ${timing.anchor}`);
  const now = new Date();
  let trigger: Notifications.NotificationTriggerInput;
  let content = getNotificationContent(course, item);

  // Helper to check if a date string (YYYY-MM-DD) is a holiday
  const isHoliday = (dateStr: string): boolean => {
    const result = db.getFirstSync(
      'SELECT id FROM holidays WHERE start_date <= ? AND end_date >= ? LIMIT 1',
      dateStr,
      dateStr
    );
    return !!result;
  };

  // Helper to calculate trigger time based on anchor
  const calculateTriggerTime = (classStart: Date, classEnd: Date): Date => {
    const triggerDate = new Date();
    switch (timing.anchor) {
      case 'before_start':
        triggerDate.setTime(classStart.getTime() - timing.value * 60 * 1000);
        break;
      case 'after_start':
        triggerDate.setTime(classStart.getTime() + timing.value * 60 * 1000);
        break;
      case 'after_end':
        triggerDate.setTime(classEnd.getTime() + timing.value * 60 * 1000);
        break;
    }
    return triggerDate;
  };

  if ('day' in item) { // It's a weekly schedule item
    const nextClassStart = getNextClassDate(item, now);
    const nextClassDateStr = formatDateToISO(nextClassStart);
    const existingRecord = db.getFirstSync<Pick<AttendanceRecord, 'status'>>(
      'SELECT status FROM attendance_records WHERE course_id = ? AND schedule_item_id = ? AND class_date = ?',
      [course.id, item.id, nextClassDateStr]
    );

    if (existingRecord?.status === 'cancelled') {
      // A cancelled class should not notify, but an already-marked present/absent
      // class should still receive its reminder.
      console.log(`[NOTIF] Attendance record for ${course.name} on ${nextClassDateStr} is cancelled. Skipping notification.`);
      return;
    }

    // Skip notification if next class is on a holiday
    if (isHoliday(nextClassDateStr)) {
      console.log(`[NOTIF] Skipping notification for ${course.name} on ${nextClassDateStr} (holiday).`);
      return;
    }
    if (isClassSkippedBySkipDay(nextClassDateStr, course.id, item.timeStart, item.timeEnd, skipDays)) {
      console.log(`[NOTIF] Skipping notification for ${course.name} on ${nextClassDateStr} (planned skip).`);
      return;
    }

    // Calculate class end time
    const [endHour, endMinute] = item.timeEnd.split(':').map(Number);
    const nextClassEnd = new Date(nextClassStart);
    nextClassEnd.setHours(endHour, endMinute, 0, 0);

    const triggerTime = calculateTriggerTime(nextClassStart, nextClassEnd);

    content = getNotificationContent(course, item, nextClassDateStr, existingRecord?.status);
    // For weekly recurring, we use WEEKLY trigger type
    // We need to convert triggerTime to weekday/hour/minute
    let triggerWeekday = triggerTime.getDay() + 1; // expo uses 1-7 (Sun=1)
    let triggerHour = triggerTime.getHours();
    let triggerMinute = triggerTime.getMinutes();

    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: triggerWeekday,
      hour: triggerHour,
      minute: triggerMinute,
      channelId: 'default',
    };

    // Catch-up logic: If the trigger time for this week has passed but it's still relevant (class hasn't ended),
    // fire an immediate one-off notification.
    const classEndWithBuffer = new Date(nextClassEnd.getTime() + timing.value * 60 * 1000);
    if (triggerTime < now && classEndWithBuffer > now) {
      console.log(`[NOTIF] Catch-up: Notification time passed but class ${course.name} is still relevant. Firing immediate notification.`);
      await Notifications.scheduleNotificationAsync({
        identifier: `${identifier}-catchup`,
        content,
        trigger: null, // Fire immediately
      });
    }
  } else { // It's an extra class
    const existingRecord = db.getFirstSync<Pick<AttendanceRecord, 'status'>>(
      'SELECT status FROM attendance_records WHERE course_id = ? AND schedule_item_id = ? AND class_date = ?',
      [course.id, item.id, item.date]
    );

    if (existingRecord?.status === 'cancelled') {
      console.log(`[NOTIF] Attendance record for extra class ${course.name} on ${item.date} is cancelled. Skipping notification.`);
      return;
    }

    content = getNotificationContent(course, item, item.date, existingRecord?.status);

    // Skip notification if extra class is on a holiday
    if (isHoliday(item.date)) {
      console.log(`[NOTIF] Skipping notification for extra class ${course.name} on ${item.date} (holiday).`);
      return;
    }
    if (isClassSkippedBySkipDay(item.date, course.id, item.timeStart, item.timeEnd, skipDays)) {
      console.log(`[NOTIF] Skipping notification for extra class ${course.name} on ${item.date} (planned skip).`);
      return;
    }

    const [year, month, day] = item.date.split('-').map(Number);
    const [startHour, startMinute] = item.timeStart.split(':').map(Number);
    const [endHour, endMinute] = item.timeEnd.split(':').map(Number);
    const classStartTime = new Date(year, month - 1, day, startHour, startMinute);
    const classEndTime = new Date(year, month - 1, day, endHour, endMinute);
    const triggerDate = calculateTriggerTime(classStartTime, classEndTime);

    // If the class itself has passed (end time + buffer), don't schedule
    const classEndWithBuffer = new Date(classEndTime.getTime() + timing.value * 60 * 1000);
    if (classEndWithBuffer < now) {
      console.log(`[NOTIF] Extra class ${course.name} on ${item.date} is no longer relevant. Skipping notification.`);
      return;
    }

    // If trigger time is in the past but class is still relevant, fire immediately
    if (triggerDate < now) {
      console.log(`[NOTIF] Trigger time for extra class ${course.name} is in the past, scheduling immediate notification.`);
      trigger = null; // Fire immediately
    } else {
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: 'default',
      };
    }
  }

  await Notifications.scheduleNotificationAsync({
    identifier,
    content,
    trigger,
  });
  console.log(`[NOTIF] Scheduled notification with identifier: ${identifier}`);
};

// Function to cancel all scheduled notifications
export const cancelAllNotifications = async () => {
  console.log('[NOTIF] Cancelling all notifications');
  await Notifications.cancelAllScheduledNotificationsAsync();
  await cancelUpdateNotification(); // Also cancel update notification
};

export const setupNotificationChannels = async () => {
  // Create the notification channel for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Class Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
    console.log('[NOTIF] Android notification channel created.');
  }

  // Set up notification categories for action buttons
  const opensAppToForeground = Platform.OS === 'ios';
  await Notifications.setNotificationCategoryAsync('class-actions', [
    { identifier: 'present', buttonTitle: 'Present', options: { opensAppToForeground } },
    { identifier: 'absent', buttonTitle: 'Absent', options: { opensAppToForeground } },
    { identifier: 'cancelled', buttonTitle: 'Cancelled', options: { opensAppToForeground } },
  ]);

  if (Platform.OS !== 'web' && !(await TaskManager.isTaskRegisteredAsync(NOTIFICATION_ACTION_TASK))) {
    await Notifications.registerTaskAsync(NOTIFICATION_ACTION_TASK);
  }
};

export const requestPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    alert('You need to enable notifications in settings');
  }
  //console.log('[NOTIF] All scheduled notifications at app start:', await Notifications.getAllScheduledNotificationsAsync());
};
