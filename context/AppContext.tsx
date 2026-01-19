import { createContext, useState, useEffect, ReactNode } from "react";
import { format } from 'date-fns-tz';
import { CustomAlert } from "../components/CustomAlert";
import { Course, AttendanceRecord, ScheduleItem, ExtraClass, Holiday, NotificationTiming, SkipDay } from "../types";
import { formatDateToISO, parseISOToDate, addDaysToDate } from "@/utils/dateHelpers";
import { cancelAllNotifications, cancelCourseNotifications, scheduleCourseNotifications } from "@/utils/notifications";
import * as db from '../utils/database';
import { calculateAttendancePercentage, createMissingAttendanceRecords } from "@/utils/attendance";

const DEFAULT_NOTIFICATION_TIMING: NotificationTiming = { value: 10, anchor: 'before_start' };

const isValidCourseId = (courseId: string) => {
  const regex = /^[a-zA-Z0-9]*$/;
  return regex.test(courseId);
};

interface AppContextType {
  holidays: Holiday[];
  addHoliday: (holiday: Holiday) => void;
  deleteHoliday: (holidayId: string) => void;
  skipDays: SkipDay[];
  addSkipDay: (skipDay: SkipDay) => void;
  deleteSkipDay: (skipDayId: string) => void;
  courses: Course[];
  loading: boolean;
  theme: string;
  notificationTiming: NotificationTiming;
  notificationsEnabled: boolean;
  is24Hour: boolean;
  updateNotificationsEnabled: boolean; // New: Update notifications enabled
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 for Sunday, 1 for Monday, etc.
  holidayBehavior: 'skip' | 'cancel'; // New: Holiday behavior setting
  settings: { [key: string]: any };
  refreshKey: number; // Add refreshKey to context type
  updateSetting: (key: string, value: any) => void;
  toggle24Hour: () => void;
  updateNotificationTiming: (timing: NotificationTiming) => void;
  toggleTheme: () => void;
  toggleNotifications: () => void;
  toggleUpdateNotifications: () => void; // New: Toggle update notifications
  updateWeekStartsOn: (dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void; // New: Update week starts on
  toggleHolidayBehavior: () => void; // New: Toggle holiday behavior
  addCourse: (newCourse: Course) => void;
  getCourse: (courseId: string) => Course | undefined;
  updateCourse: (updatedCourse: Course) => void;
  deleteCourse: (courseId: string) => void;
  isValidCourseId: (courseId: string) => boolean;
  addScheduleItem: (courseId: string, newScheduleItem: ScheduleItem) => void;
  addExtraClass: (
    courseId: string,
    date: string,
    timeStart: string,
    timeEnd: string
  ) => void;
  deleteExtraClass: (courseId: string, extraClassId: string) => void;
  clearData: () => void;
  updateCourseCounts: (courseId: string, countType: "presents" | "absents" | "cancelled", newValue: number) => void;
  archiveCourse: (courseId: string) => void;
  unarchiveCourse: (courseId: string) => void;
  upsertAttendance: (courseId: string, scheduleId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean, timeStart: string, timeEnd: string, date: string) => void;
  deleteAttendanceRecord: (courseId: string, date: string, timeStart: string, timeEnd: string, isExtraClass: boolean) => void;
  save: () => Promise<void>;
  loadData: () => void;
  triggerRefresh: () => void; // Add triggerRefresh to context type
  getCoursesWithRecordsInRange: (startDate: string, endDate: string) => Promise<Course[]>;
  getPaginatedAttendanceRecords: (page: number, limit: number, courseIds?: string[], startDate?: string, endDate?: string) => void;
  attendanceRecords: AttendanceRecord[];
  totalRecords: number;
}

export const AppContext = createContext<AppContextType>({
  holidays: [],
  addHoliday: () => { },
  deleteHoliday: () => { },
  skipDays: [],
  addSkipDay: () => { },
  deleteSkipDay: () => { },
  courses: [],
  loading: true,
  theme: "light",
  notificationTiming: DEFAULT_NOTIFICATION_TIMING,
  notificationsEnabled: false,
  is24Hour: false,
  updateNotificationsEnabled: false, // New: Update notifications enabled
  weekStartsOn: 0, // Default to Sunday
  holidayBehavior: 'skip', // Default holiday behavior
  settings: {},
  refreshKey: 0, // Initialize refreshKey
  updateSetting: () => { },
  toggle24Hour: () => { },
  updateNotificationTiming: () => { },
  toggleTheme: () => { },
  toggleNotifications: () => { },
  toggleUpdateNotifications: () => { }, // New: Toggle update notifications
  updateWeekStartsOn: () => { }, // Initialize updateWeekStartsOn
  toggleHolidayBehavior: () => { }, // Initialize toggleHolidayBehavior
  addCourse: () => { },
  getCourse: () => undefined,
  updateCourse: () => { },
  deleteCourse: () => { },
  isValidCourseId: (courseId: string) => isValidCourseId(courseId),
  addScheduleItem: () => { },
  addExtraClass: () => { },
  deleteExtraClass: () => { },
  clearData: () => { },
  updateCourseCounts: () => { },
  archiveCourse: () => { },
  unarchiveCourse: () => { },
  upsertAttendance: () => { },
  deleteAttendanceRecord: () => { },
  save: () => Promise.resolve(),
  loadData: () => { },
  triggerRefresh: () => { }, // Initialize triggerRefresh
  getCoursesWithRecordsInRange: () => Promise.resolve([]),
  getPaginatedAttendanceRecords: () => { },
  attendanceRecords: [],
  totalRecords: 0,
});

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [theme, setTheme] = useState<string>("light");
  const [notificationTiming, setNotificationTiming] = useState<NotificationTiming>(DEFAULT_NOTIFICATION_TIMING);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [is24Hour, setIs24Hour] = useState(false);
  const [updateNotificationsEnabled, setUpdateNotificationsEnabled] = useState(false); // New state
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0); // New state for weekStartsOn
  const [holidayBehavior, setHolidayBehavior] = useState<'skip' | 'cancel'>('skip'); // New state for holiday behavior
  const [settings, setSettings] = useState<{ [key: string]: any }>({});
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0); // New state for refresh
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [skipDays, setSkipDays] = useState<SkipDay[]>([]);

  const updateSetting = (key: string, value: any) => {
    console.log(`[AppContext] updateSetting: key=${key}, value=${value}`);
    db.updateSetting(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const loadData = () => {
    console.log('[AppContext] Loading data...');
    setLoading(true);
    try {
      const loadedSettings = db.getSettings();
      console.log('[AppContext] Loaded settings:', loadedSettings);
      setSettings(loadedSettings);
      setTheme(loadedSettings.theme || 'light');
      // Handle backward compatibility: old settings store just a number, new settings store JSON
      const rawNotifTime = loadedSettings.notificationTiming || loadedSettings.notificationTime;
      if (rawNotifTime) {
        try {
          const parsed = JSON.parse(rawNotifTime);
          if (typeof parsed === 'object' && 'value' in parsed && 'anchor' in parsed) {
            setNotificationTiming(parsed);
          } else {
            // Fallback for plain number stored as string
            setNotificationTiming({ value: parseInt(rawNotifTime, 10) || 10, anchor: 'before_start' });
          }
        } catch {
          // If JSON parse fails, it's a plain number
          setNotificationTiming({ value: parseInt(rawNotifTime, 10) || 10, anchor: 'before_start' });
        }
      }
      setNotificationsEnabled(loadedSettings.notificationsEnabled === 'true');
      setIs24Hour(loadedSettings.is24Hour === 'true');
      setUpdateNotificationsEnabled(loadedSettings.updateNotificationsEnabled === 'true'); // Load new setting
      setWeekStartsOn(parseInt(loadedSettings.weekStartsOn || '0', 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6); // Load new setting
      setHolidayBehavior((loadedSettings.holidayBehavior as 'skip' | 'cancel') || 'skip'); // Load new setting

      const loadedCourses = db.getCourses();
      console.log(`[AppContext] Loaded ${loadedCourses.length} courses.`);
      setCourses(loadedCourses);
      const loadedHolidays = db.getHolidays();
      console.log(`[AppContext] Loaded ${loadedHolidays.length} holidays.`);
      setHolidays(loadedHolidays);
      const loadedSkipDays = db.getSkipDays();
      console.log(`[AppContext] Loaded ${loadedSkipDays.length} skip days.`);
      setSkipDays(loadedSkipDays);
      getPaginatedAttendanceRecords(currentPage, 10);
    } catch (error) {
      console.error("[AppContext] Failed to load data from database", error);
    } finally {
      setLoading(false);
      console.log('[AppContext] Data loading complete.');
    }
  };

  const triggerRefresh = () => {
    console.log('[AppContext] Forcing refresh...');
    setRefreshKey(prev => prev + 1);
    loadData(); // Also reload data when refresh is triggered
  };

  useEffect(() => {
    console.log('[AppContext] Initializing database and loading data on mount.');
    db.initDatabase();
    const needsUpdate = createMissingAttendanceRecords();
    if (needsUpdate) {
      console.log('[AppContext] New attendance records were created, triggering refresh.');
      triggerRefresh(); // Call triggerRefresh if update is needed
    } else {
      console.log('[AppContext] No new attendance records, loading initial data.');
      loadData(); // Load initial data if no update is needed
    }
  }, []);


  const toggle24Hour = () => {
    const newIs24Hour = !is24Hour;
    console.log(`[AppContext] Toggling 24-hour format to: ${newIs24Hour}`);
    setIs24Hour(newIs24Hour);
    db.updateSetting('is24Hour', newIs24Hour.toString());
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    console.log(`[AppContext] Toggling theme to: ${newTheme}`);
    setTheme(newTheme);
    db.updateSetting('theme', newTheme);
  };

  const toggleNotifications = () => {
    const newNotificationsEnabled = !notificationsEnabled;
    console.log(`[AppContext] Toggling notifications to: ${newNotificationsEnabled}`);
    setNotificationsEnabled(newNotificationsEnabled);
    db.updateSetting('notificationsEnabled', newNotificationsEnabled.toString());
  };

  const toggleUpdateNotifications = () => {
    const newUpdateNotificationsEnabled = !updateNotificationsEnabled;
    console.log(`[AppContext] Toggling update notifications to: ${newUpdateNotificationsEnabled}`);
    setUpdateNotificationsEnabled(newUpdateNotificationsEnabled);
    db.updateSetting('updateNotificationsEnabled', newUpdateNotificationsEnabled.toString());
  };

  const updateNotificationTiming = (timing: NotificationTiming) => {
    console.log(`[AppContext] Updating notification timing to:`, timing);
    setNotificationTiming(timing);
    db.updateSetting('notificationTiming', JSON.stringify(timing));
  };

  const updateWeekStartsOn = (dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6) => {
    console.log(`[AppContext] Updating weekStartsOn to: ${dayIndex}`);
    setWeekStartsOn(dayIndex);
    db.updateSetting('weekStartsOn', dayIndex.toString());
  };

  const toggleHolidayBehavior = () => {
    const newHolidayBehavior = holidayBehavior === 'skip' ? 'cancel' : 'skip';
    console.log(`[AppContext] Toggling holiday behavior to: ${newHolidayBehavior}`);
    setHolidayBehavior(newHolidayBehavior);
    db.updateSetting('holidayBehavior', newHolidayBehavior);
  };

  const addCourse = (newCourse: Course) => {
    console.log(`[AppContext] Attempting to add course: ${newCourse.name} (${newCourse.id})`);
    const courseId = newCourse.id.trim();
    if (!isValidCourseId(courseId)) {
      console.error("[AppContext] Invalid course ID provided:", courseId);
      return;
    }
    if (courses.some(c => c.id.toLowerCase() === courseId.toLowerCase())) {
      console.error("[AppContext] Course with this ID already exists:", courseId);
      return;
    }
    const courseWithInitializedCounters = {
      ...newCourse,
      requiredAttendance: newCourse.requiredAttendance || 75,
      attendanceRecords: newCourse.attendanceRecords || [],
      weeklySchedule: newCourse.weeklySchedule || [],
      extraClasses: newCourse.extraClasses || [],
      isArchived: false,
      createdAt: formatDateToISO(new Date()),
    };
    db.addCourse(courseWithInitializedCounters);
    setCourses(prev => [...prev, courseWithInitializedCounters]);
    console.log(`[AppContext] Course added successfully: ${newCourse.name}`);
  };

  const updateCourse = (updatedCourse: Course) => {
    console.log(`[AppContext] Updating course: ${updatedCourse.name} (${updatedCourse.id})`);
    // Check if weekly schedule has changed (dates/times)
    // If so, update createdAt to NOW so we don't retroactively mark attendance
    // for the new schedule in the distant past. We use JSON.stringify for deep comparison.
    const oldSchedule = courses.find(c => c.id === updatedCourse.id)?.weeklySchedule || [];
    const newSchedule = updatedCourse.weeklySchedule || [];

    // Simple deep compare using JSON stringify (sufficient for this data structure)
    // Sorting potentially needed if order doesn't matter, but usually order is preserved or irrelevant for "change detection" purposes here if strict.
    // Let's rely on simple stringify for now.
    const scheduleChanged = JSON.stringify(oldSchedule) !== JSON.stringify(newSchedule);

    let finalCourse = { ...updatedCourse };

    if (scheduleChanged) {
      console.log(`[AppContext] Schedule changed for ${updatedCourse.name}. Updating createdAt to now.`);
      finalCourse.createdAt = formatDateToISO(new Date());
    }

    db.updateCourse(finalCourse); // Update the database first

    // Recalculate attendance percentage based on the updated presents/absents from the form
    const totalClasses = finalCourse.presents + finalCourse.absents;
    const newAttendancePercentage = totalClasses > 0 ? Math.round((finalCourse.presents / totalClasses) * 100) : 100;

    const courseWithCalculatedPercentage = {
      ...finalCourse,
      attendancePercentage: newAttendancePercentage,
    };

    setCourses(prev => prev.map(c => c.id === finalCourse.id ? courseWithCalculatedPercentage : c));
    console.log(`[AppContext] Course updated successfully: ${finalCourse.name}. New attendance percentage: ${newAttendancePercentage}%`);
  };

  const deleteCourse = async (courseId: string) => {
    console.log(`[AppContext] Deleting course: ${courseId}`);
    await cancelCourseNotifications(courseId);
    db.deleteCourse(courseId);
    setCourses(prev => prev.filter(c => c.id !== courseId));
    console.log(`[AppContext] Course deleted successfully: ${courseId}`);
  };

  const addScheduleItem = (courseId: string, newScheduleItem: ScheduleItem) => {
    console.log(`[AppContext] Adding schedule item to course: ${courseId}, day: ${newScheduleItem.day}, time: ${newScheduleItem.timeStart}-${newScheduleItem.timeEnd}`);
    db.addScheduleItem(courseId, newScheduleItem);
    const updatedCourses = courses.map(c => {
      if (c.id === courseId) {
        return { ...c, weeklySchedule: [...(c.weeklySchedule || []), newScheduleItem] };
      }
      return c;
    });
    setCourses(updatedCourses);
    console.log(`[AppContext] Schedule item added for course: ${courseId}.`);
  };

  const addExtraClass = (courseId: string, date: string, timeStart: string, timeEnd: string) => {
    console.log(`[AppContext] Adding extra class to course: ${courseId}, date: ${date}, time: ${timeStart}-${timeEnd}`);
    const newExtraClass: ExtraClass = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date,
      timeStart,
      timeEnd,
    };
    db.addExtraClass(courseId, newExtraClass);
    const updatedCourses = courses.map(c => {
      if (c.id === courseId) {
        return { ...c, extraClasses: [...(c.extraClasses || []), newExtraClass] };
      }
      return c;
    });
    setCourses(updatedCourses);
    console.log(`[AppContext] Extra class added for course: ${courseId}.`);
  };

  const deleteExtraClass = (courseId: string, extraClassId: string) => {
    console.log(`[AppContext] Deleting extra class ${extraClassId} from course ${courseId}`);
    db.deleteExtraClass(courseId, extraClassId);
    const updatedCourses = courses.map(c => {
      if (c.id === courseId) {
        return { ...c, extraClasses: (c.extraClasses || []).filter(ec => ec.id !== extraClassId) };
      }
      return c;
    });
    setCourses(updatedCourses);
    console.log(`[AppContext] Extra class ${extraClassId} deleted from course ${courseId}.`);
  };

  const clearData = () => {
    console.log('[AppContext] Clearing all data...');
    db.clearAllData();
    setCourses([]);
    setTheme('light');
    setNotificationTiming(DEFAULT_NOTIFICATION_TIMING);
    setNotificationsEnabled(false);
    setIs24Hour(false);
    console.log('[AppContext] All data cleared.');
  };

  const addHoliday = (holiday: Holiday) => {
    console.log(`[AppContext] Adding holiday: ${holiday.name}`);
    db.addHoliday(holiday);
    setHolidays(prev => [...prev, holiday]);
    // The alert will be handled by the component that calls addHoliday
  };

  const deleteHoliday = (holidayId: string) => {
    console.log(`[AppContext] Deleting holiday: ${holidayId}`);
    db.deleteHoliday(holidayId);
    setHolidays(prev => prev.filter(h => h.id !== holidayId));
  };

  const addSkipDay = (skipDay: SkipDay) => {
    console.log(`[AppContext] Adding skip day: ${skipDay.date}`);
    db.addSkipDay(skipDay);
    setSkipDays(prev => [...prev, skipDay]);
  };

  const deleteSkipDay = (skipDayId: string) => {
    console.log(`[AppContext] Deleting skip day: ${skipDayId}`);
    db.deleteSkipDay(skipDayId);
    setSkipDays(prev => prev.filter(s => s.id !== skipDayId));
  };

  const archiveCourse = async (courseId: string) => {
    console.log(`[AppContext] Archiving course: ${courseId}`);
    await cancelCourseNotifications(courseId);
    db.archiveCourse(courseId);
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, isArchived: true, archivedAt: formatDateToISO(new Date()) } : c));
    console.log(`[AppContext] Course archived: ${courseId}`);
  };

  const unarchiveCourse = async (courseId: string) => {
    console.log(`[AppContext] Unarchiving course: ${courseId}`);
    const course = courses.find(c => c.id === courseId);
    if (course) {
      await scheduleCourseNotifications(course, notificationTiming);
      db.unarchiveCourse(courseId);
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, isArchived: false, archivedAt: undefined } : c));
      console.log(`[AppContext] Course unarchived: ${courseId}`);
    } else {
      console.log(`[AppContext] Course not found for unarchive: ${courseId}`);
    }
  };

  const upsertAttendance = (courseId: string, scheduleId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean, timeStart: string, timeEnd: string, date: string) => {
    console.log(`[AppContext] upsertAttendance called for course: ${courseId}, scheduleId: ${scheduleId}, status: ${status}, date: ${date}`);
    const course = courses.find(c => c.id.toLowerCase() === courseId.toLowerCase());
    if (!course) {
      console.log(`[AppContext] Course not found for upsertAttendance: ${courseId}`);
      return;
    }

    const existingRecord = course.attendanceRecords?.find(
      (record) =>
        record.date === date &&
        record.isExtraClass === isExtraClass &&
        record.timeStart === timeStart &&
        record.timeEnd === timeEnd
    );

    if (existingRecord) {
      console.log(`[AppContext] Existing attendance record found for ${courseId} on ${date}. Updating status from ${existingRecord.status} to ${status}.`);
      if (existingRecord.status === status) {
        console.log(`[AppContext] Status for record ${existingRecord.id} is already ${status}. No update needed.`);
        return;
      }
      db.updateAttendanceRecord(existingRecord.id, status);
    } else {
      console.log(`[AppContext] No existing attendance record found for ${courseId} on ${date}. Creating new record with status: ${status}.`);
      const newRecord: AttendanceRecord = {
        id: `${courseId}-${scheduleId}-${date}`,
        course_id: courseId,
        date,
        status,
        isExtraClass,
        scheduleItemId: scheduleId,
        timeStart,
        timeEnd,
      };
      db.addAttendanceRecord(newRecord);
    }
    triggerRefresh();
    console.log(`[AppContext] Attendance update for ${courseId} on ${date} complete. Triggered refresh.`);
  };

  const deleteAttendanceRecord = (courseId: string, date: string, timeStart: string, timeEnd: string, isExtraClass: boolean) => {
    console.log(`[AppContext] deleteAttendanceRecord called for course: ${courseId}, date: ${date}, time: ${timeStart}-${timeEnd}, isExtraClass: ${isExtraClass}`);
    const course = courses.find(c => c.id.toLowerCase() === courseId.toLowerCase());
    if (!course) {
      console.log(`[AppContext] Course not found for deleteAttendanceRecord: ${courseId}`);
      return;
    }

    const existingRecord = course.attendanceRecords?.find(
      (record) =>
        record.date === date &&
        record.isExtraClass === isExtraClass &&
        record.timeStart === timeStart &&
        record.timeEnd === timeEnd
    );

    if (existingRecord) {
      console.log(`[AppContext] Found attendance record to delete: ${existingRecord.id}`);
      db.deleteAttendanceRecord(existingRecord.id);
      if (existingRecord.isExtraClass) {
        deleteExtraClass(course.id, existingRecord.id);
      }
      triggerRefresh(); // Add this line to trigger a refresh
      console.log(`[AppContext] Attendance record deleted for ${courseId} on ${date}. Triggered refresh.`);
    } else {
      console.log(`[AppContext] No attendance record found to delete for ${courseId} on ${date}`);
    }
  };

  const updateCourseCounts = (courseId: string, countType: "presents" | "absents" | "cancelled", newValue: number) => {
    console.log(`[AppContext] Updating course counts for: ${courseId}, type: ${countType}, newValue: ${newValue}`);
    const course = courses.find(c => c.id === courseId);
    if (course) {
      const updatedCourse = { ...course, [countType]: newValue };
      updatedCourse.attendancePercentage = calculateAttendancePercentage(updatedCourse.presents, updatedCourse.absents);
      updateCourse(updatedCourse);
      console.log(`[AppContext] Course counts updated for ${courseId}. New percentage: ${updatedCourse.attendancePercentage}%`);
    } else {
      console.log(`[AppContext] Course not found for updateCourseCounts: ${courseId}`);
    }
  };

  const save = async () => {
    console.log('[AppContext] Saving all settings and course data...');
    db.updateSetting('theme', theme);
    db.updateSetting('notificationTiming', JSON.stringify(notificationTiming));
    db.updateSetting('notificationsEnabled', notificationsEnabled.toString());
    db.updateSetting('is24Hour', is24Hour.toString());
    db.updateSetting('updateNotificationsEnabled', updateNotificationsEnabled.toString()); // Save new setting
    db.updateSetting('weekStartsOn', weekStartsOn.toString()); // Save new setting
    db.updateSetting('holidayBehavior', holidayBehavior); // Save new setting

    courses.forEach(course => {
      db.updateCourse(course);
    });
    console.log('[AppContext] Save complete.');
  };

  useEffect(() => {
    if (!loading) {
      const rescheduleAllNotifications = async () => {
        console.log('[AppContext] Rescheduling all notifications...');
        await cancelAllNotifications();
        for (const course of courses) {
          if (!course.isArchived) {
            await scheduleCourseNotifications(course, notificationTiming);
          }
        }
        console.log('[AppContext] All notifications rescheduled.');
      };
      rescheduleAllNotifications();
    }
  }, [courses, loading, notificationTiming]);

  const getCoursesWithRecordsInRange = async (startDate: string, endDate: string): Promise<Course[]> => {
    console.log(`[AppContext] Getting courses with records in range: ${startDate} to ${endDate}`);
    setLoading(true);
    try {
      const loadedCourses = db.getCoursesWithRecordsInRange(startDate, endDate);
      console.log(`[AppContext] Found ${loadedCourses.length} courses with records in range.`);
      return loadedCourses;
    } catch (error) {
      console.error("[AppContext] Failed to load courses with date range from database", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getPaginatedAttendanceRecords = (page: number, limit: number, courseIds?: string[], startDate?: string, endDate?: string) => {
    console.log(`[AppContext] Getting paginated attendance records: page=${page}, limit=${limit}, courseIds=${(courseIds && Array.isArray(courseIds)) ? courseIds.join(',') : 'all'}, startDate=${startDate || 'N/A'}, endDate=${endDate || 'N/A'}`);
    setLoading(true);
    try {
      setCurrentPage(page);
      const offset = (page - 1) * limit;
      const records = db.getAttendanceRecords(limit, offset, courseIds, startDate, endDate);
      const total = db.getAttendanceRecordsCount(courseIds, startDate, endDate);
      setAttendanceRecords(records);
      setTotalRecords(total);
      console.log(`[AppContext] Loaded ${records.length} records (total: ${total}) for page ${page}.`);
    } catch (error) {
      console.error("[AppContext] Failed to load paginated attendance records from database", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        holidays,
        addHoliday,
        deleteHoliday,
        skipDays,
        addSkipDay,
        deleteSkipDay,
        courses,
        loading,
        theme,
        notificationTiming,
        notificationsEnabled,
        is24Hour,
        updateNotificationsEnabled,
        weekStartsOn,
        holidayBehavior, // Expose new setting
        settings,
        refreshKey,
        updateSetting,
        toggle24Hour,
        updateNotificationTiming,
        toggleTheme,
        toggleNotifications,
        toggleUpdateNotifications,
        updateWeekStartsOn,
        toggleHolidayBehavior, // Expose new toggle function
        addCourse,
        getCourse: (courseId: string) => courses.find((course) => course.id === courseId),
        updateCourse,
        deleteCourse,
        isValidCourseId,
        addScheduleItem,
        addExtraClass,
        deleteExtraClass,
        clearData,
        archiveCourse,
        unarchiveCourse,
        upsertAttendance,
        deleteAttendanceRecord,
        updateCourseCounts,
        save,
        loadData,
        triggerRefresh,
        getCoursesWithRecordsInRange,
        getPaginatedAttendanceRecords,
        attendanceRecords,
        totalRecords,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
