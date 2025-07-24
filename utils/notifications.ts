import * as Notifications from 'expo-notifications';
import { Course, ScheduleItem, ExtraClass } from '@/types';

// Function to schedule notifications for a single course
export const scheduleCourseNotifications = async (course: Course, notificationTime: number) => {
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
  await Notifications.cancelAllScheduledNotificationsAsync();
};

// Function to cancel notifications for a single course
export const cancelCourseNotifications = async (courseId: string) => {
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

  const delta = getAttendanceDelta(presents, absents, requiredAttendance);
  let deltaMessage: string;

  if (delta > 0) {
    deltaMessage = `You need to attend ${delta} more class(es).`;
  } else if (delta === 0) {
    deltaMessage = 'At required attendance';
  } else {
    deltaMessage = `You can bunk ${-delta} class(es).`;
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
): number => {
  const total = presents + absents;
  const requiredFraction = requiredAttendance / 100;
  if (total === 0) {
    return 0;
  }
  const currentFraction = presents / total;
  if (currentFraction >= requiredFraction) {
    return -Math.floor(presents / requiredFraction - total);
  } else {
    return Math.ceil(
      (requiredFraction * total - presents) / (1 - requiredFraction)
    );
  }
};

const scheduleNotification = async (course: Course, item: ScheduleItem | ExtraClass, notificationTime: number) => {
  const content = getNotificationContent(course, item);
  const now = new Date();
  let trigger: Notifications.NotificationTriggerInput;
  let scheduledTime: Date;

  if ('day' in item) { // It's a weekly schedule item
    const dayIndex = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      .indexOf(item.day);

    // 1) Build next-possible class date at the exact start time:
    const [h, m] = item.timeStart.split(':').map(Number);
    const nextClass = new Date();
    const daysUntil = (dayIndex - nextClass.getDay() + 7) % 7;
    nextClass.setDate(nextClass.getDate() + daysUntil);
    nextClass.setHours(h, m, 0, 0);

    // 2) Subtract your notificationTime
    nextClass.setMinutes(nextClass.getMinutes() - notificationTime);

    // 3) If that lands you still in the past, add 7 more days
    if (nextClass < now) {
      nextClass.setDate(nextClass.getDate() + 7);
    }

    scheduledTime = new Date(nextClass);
    // 4) Push only the final hour/minute back into a repeating trigger
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: dayIndex + 1, // 1 = Sunday … 7 = Saturday
      hour: nextClass.getHours(),
      minute: nextClass.getMinutes(),
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

    scheduledTime = date;
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      channelId: 'default',
      date: date,
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
