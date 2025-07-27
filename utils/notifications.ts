import * as Notifications from 'expo-notifications';
import { Course, ScheduleItem, ExtraClass } from '@/types';

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

// Function to cancel all scheduled notifications
export const cancelAllNotifications = async () => {
  console.log('[NOTIF] Cancelling all notifications');
  await Notifications.cancelAllScheduledNotificationsAsync();
};

// Function to cancel notifications for a single course
export const cancelCourseNotifications = async (courseId: string) => {
  console.log(`[NOTIF] Cancelling notifications for course: ${courseId}`);
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduledNotifications) {
    if (notification.content.data.courseId === courseId) {
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

  if (type === 'attend') {
    deltaMessage = `You need to attend ${count} more class(es).`;
  } else {
    deltaMessage = `You can bunk ${count} class(es).`;
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
  console.log(`[NOTIF] Scheduling notification for course: ${course.name}, item: ${item.id}`);
  const content = getNotificationContent(course, item);
  const now = new Date();
  let trigger: Notifications.NotificationTriggerInput;

  if ('day' in item) { // It's a weekly schedule item
    const nextClassDate = getNextClassDate(item, now);
    nextClassDate.setMinutes(nextClassDate.getMinutes() - notificationTime);

    if (nextClassDate < now) {
      nextClassDate.setDate(nextClassDate.getDate() + 7);
    }

    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: nextClassDate.getDay() + 1,
      hour: nextClassDate.getHours(),
      minute: nextClassDate.getMinutes(),
      channelId: 'default',
    };
  } else { // It's an extra class
    const [year, month, day] = item.date.split('-').map(Number);
    const [hour, minute] = item.timeStart.split(':').map(Number);
    const date = new Date(year, month - 1, day, hour, minute);
    date.setMinutes(date.getMinutes() - notificationTime);

    if (date < now) { // Don't schedule for past extra classes
      return;
    }
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: 'default',
    };
  }

  const identifier = `${course.id}-${item.id}`;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content,
    trigger,
  });
};

export const setupNotificationChannels = async () => {
  await Notifications.setNotificationCategoryAsync('class-actions', [
    { identifier: 'present', buttonTitle: 'Present', options: { opensAppToForeground: true } },
    { identifier: 'absent', buttonTitle: 'Absent', options: { opensAppToForeground: true } },
    { identifier: 'cancelled', buttonTitle: 'Cancelled', options: { opensAppToForeground: true } },
  ]);
};

export const requestPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    alert('You need to enable notifications in settings');
  }
};
