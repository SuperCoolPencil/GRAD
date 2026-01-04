import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Course, ScheduleItem, ExtraClass, AttendanceRecord } from '@/types';
import { db, getCourseById, getAttendanceRecords, updateAttendanceRecord, addAttendanceRecord } from './database';
import { formatDateToISO } from './dateHelpers';
import { calculateAttendancePercentage } from './attendance'

// Function to schedule notifications for a single course
export const scheduleCourseNotifications = async (course: Course, notificationTime: number) => {
  console.log(`[NOTIF] Scheduling notifications for course: ${course.name}`);
  // First, cancel any existing notifications for this course to avoid duplicates
  await cancelCourseNotifications(course.id);

  const { weeklySchedule, extraClasses } = course;

  if (weeklySchedule) {
    for (const item of weeklySchedule) {
      await scheduleNotification(course, item, notificationTime);
    }
  }

  if (extraClasses) {
    for (const item of extraClasses) {
      await scheduleNotification(course, item, notificationTime);
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
  notificationIdentifier: string
) => {
  console.log(`[NOTIF_HANDLER] Handling action: ${actionIdentifier} for course: ${courseId}, schedule: ${scheduleId}`);

  const course = getCourseById(courseId);
  if (!course) {
    console.log(`[NOTIF_HANDLER] Course not found for ID: ${courseId}`);
    return;
  }

  const isExtraClass = course.extraClasses?.some(ec => ec.id === scheduleId) || false;
  const scheduleItem = course.weeklySchedule?.find(s => s.id === scheduleId);
  const extraClassItem = course.extraClasses?.find(e => e.id === scheduleId);

  const timeStart = scheduleItem?.timeStart || extraClassItem?.timeStart || '';
  const timeEnd = scheduleItem?.timeEnd || extraClassItem?.timeEnd || '';
  const date = extraClassItem?.date || formatDateToISO(new Date());

  const existingRecord = getAttendanceRecords(-1, 0, [courseId], date, date).find(
    (record) =>
      record.date === date &&
      record.isExtraClass === isExtraClass &&
      record.timeStart === timeStart &&
      record.timeEnd === timeEnd
  );

  if (existingRecord) {
    console.log(`[NOTIF_HANDLER] Existing attendance record found for ${courseId} on ${date}. Updating status from ${existingRecord.status} to ${actionIdentifier}.`);
    if (existingRecord.status === actionIdentifier) {
      console.log(`[NOTIF_HANDLER] Status for record ${existingRecord.id} is already ${actionIdentifier}. No update needed.`);
    } else {
      updateAttendanceRecord(existingRecord.id, actionIdentifier);
    }
  } else {
    console.log(`[NOTIF_HANDLER] No existing attendance record found for ${courseId} on ${date}. Creating new record with status: ${actionIdentifier}.`);
    const newRecord: AttendanceRecord = {
      id: `${courseId}-${scheduleId}-${date}`, // Unique ID for the record
      course_id: courseId,
      date,
      status: actionIdentifier,
      isExtraClass,
      scheduleItemId: scheduleId,
      timeStart,
      timeEnd,
    };
    addAttendanceRecord(newRecord);
  }

  // Dismiss the notification after handling the action
  await Notifications.dismissNotificationAsync(notificationIdentifier);
  console.log(`[NOTIF_HANDLER] Notification ${notificationIdentifier} dismissed.`);

  // Optionally, trigger a refresh for the app if it's in the foreground
  // This part would typically be handled by the AppContext if the app is active.
  // For background, the database update is sufficient.
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
const getNotificationContent = (course: Course, item: ScheduleItem | ExtraClass) => {

  const attendancePercentage = course.attendancePercentage || 0;
  const presents = course.presents || 0;
  const absents = course.absents || 0;
  const requiredAttendance = course.requiredAttendance || 75;

  const { type, count } = getAttendanceDelta(presents, absents, requiredAttendance);
  let deltaMessage: string;

  if (type === 'attend' && count > 0) {
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
    data: { courseId: course.id, scheduleId: item.id },
    categoryIdentifier: 'class-actions',
  };
};

const getAttendanceDelta = (
  presents: number,
  absents: number,
  requiredAttendance: number
): { type: 'bunk' | 'attend'; count: number } => {
  const total = presents + absents;
  const requiredFraction = requiredAttendance / 100;

  if (total === 0) {
    return { type: 'attend', count: 0 };
  }

  const currentFraction = presents / total;

  if (currentFraction >= requiredFraction) {
    const bunksAvailable = Math.floor(presents / requiredFraction - total);
    return { type: 'bunk', count: bunksAvailable };
  } else {
    const mustAttend = Math.ceil((requiredFraction * total - presents) / (1 - requiredFraction));
    return { type: 'attend', count: mustAttend };
  }
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

const scheduleNotification = async (course: Course, item: ScheduleItem | ExtraClass, notificationTime: number) => {
  const identifier = `${course.id}-${item.id}`;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  if (existing.some(n => n.identifier === identifier)) {
    console.log(`[NOTIF] Notification with identifier ${identifier} already exists. Skipping.`);
    return;
  }

  console.log(`[NOTIF] Scheduling notification for course: ${course.name}, item: ${item.id}`);
  const content = getNotificationContent(course, item);
  const now = new Date();
  let trigger: Notifications.NotificationTriggerInput;

  if ('day' in item) { // It's a weekly schedule item
    const nextClassDate = getNextClassDate(item, now);
    // Note: We intentionally do NOT check for existing attendance records here.
    // Weekly notifications are recurring and should always be scheduled.
    // The notification handler can suppress the banner if attendance is already marked.

    // Adjust hour and minute directly for the trigger
    let triggerHour = nextClassDate.getHours();
    let triggerMinute = nextClassDate.getMinutes() - notificationTime;
    let triggerWeekday = nextClassDate.getDay() + 1; // expo uses 1-7 (Sun=1)

    if (triggerMinute < 0) {
      triggerMinute += 60;
      triggerHour -= 1;
    }
    if (triggerHour < 0) {
      triggerHour += 24;
      // Wrap weekday to previous day
      triggerWeekday -= 1;
      if (triggerWeekday < 1) {
        triggerWeekday = 7; // Wrap Sunday (1) to Saturday (7)
      }
    }

    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: triggerWeekday,
      hour: triggerHour,
      minute: triggerMinute,
      channelId: 'default',
    };
  } else { // It's an extra class
    const existingRecord = db.getFirstSync(
      'SELECT id FROM attendance_records WHERE course_id = ? AND schedule_item_id = ? AND class_date = ?',
      [course.id, item.id, item.date]
    );

    if (existingRecord) {
      console.log(`[NOTIF] Attendance record for extra class ${course.name} on ${item.date} already exists. Skipping notification.`);
      return;
    }

    const [year, month, day] = item.date.split('-').map(Number);
    const [hour, minute] = item.timeStart.split(':').map(Number);
    const classStartTime = new Date(year, month - 1, day, hour, minute);
    const triggerDate = new Date(classStartTime);
    triggerDate.setMinutes(triggerDate.getMinutes() - notificationTime);

    // If the class itself is in the past, don't schedule
    if (classStartTime < now) {
      console.log(`[NOTIF] Extra class ${course.name} on ${item.date} has already passed. Skipping notification.`);
      return;
    }

    // If trigger time is in the past but class hasn't started, fire immediately
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
  await Notifications.setNotificationCategoryAsync('class-actions', [
    { identifier: 'present', buttonTitle: 'Present', options: { opensAppToForeground: false } },
    { identifier: 'absent', buttonTitle: 'Absent', options: { opensAppToForeground: false } },
    { identifier: 'cancelled', buttonTitle: 'Cancelled', options: { opensAppToForeground: false } },
  ]);
};

export const requestPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    alert('You need to enable notifications in settings');
  }
  //console.log('[NOTIF] All scheduled notifications at app start:', await Notifications.getAllScheduledNotificationsAsync());
};
