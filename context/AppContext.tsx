import { createContext, useState, useEffect, ReactNode } from "react";
import { format } from 'date-fns-tz';
import { CustomAlert } from "../components/CustomAlert";
import { Course, AttendanceRecord, ScheduleItem, ExtraClass } from "../types";
import { cancelAllNotifications, cancelCourseNotifications, scheduleCourseNotifications } from "@/utils/notifications";
import * as db from '../utils/database';
import { calculateAttendancePercentage, createMissingAttendanceRecords } from "@/utils/attendance";

const isValidCourseId = (courseId: string) => {
  const regex = /^[a-zA-Z0-9]*$/;
  return regex.test(courseId);
};

interface AppContextType {
  courses: Course[];
  loading: boolean;
  theme: string;
  notificationTime: number;
  notificationsEnabled: boolean;
  is24Hour: boolean;
  settings: { [key: string]: any };
  updateSetting: (key: string, value: any) => void;
  toggle24Hour: () => void;
  updateNotificationTime: (time: number) => void;
  toggleTheme: () => void;
  toggleNotifications: () => void;
  addCourse: (newCourse: Course) => void;
  editCourse: (updatedCourse: Course) => void;
  getCourse: (courseId: string) => Course | undefined;
  updateCourse: (updatedCourse: Course) => void;
  deleteCourse: (courseId: string) => void;
  changeAttendanceRecord: (courseId: string, recordId: string, newStatus: "present" | "absent" | "cancelled") => void;
  isValidCourseId: (courseId: string) => boolean;
  markAttendance: (
    courseId: string,
    status: "present" | "absent" | "cancelled",
    isExtraClass: boolean,
    scheduleItemId: string | undefined,
    timeStart: string,
    timeEnd: string
  ) => void;
  addScheduleItem: (courseId: string, newScheduleItem: ScheduleItem) => void;
  addExtraClass: (
    courseId: string,
    date: string,
    timeStart: string,
    timeEnd: string
  ) => void;
  clearData: () => void;
  recalculateCourseCounts: (courseId: string) => void;
  updateCourseCounts: (courseId: string, countType: "presents" | "absents" | "cancelled", newValue: number) => void;
  archiveCourse: (courseId: string) => void;
  unarchiveCourse: (courseId: string) => void;
  upsertAttendance: (courseId: string, scheduleId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean, timeStart: string, timeEnd: string, date: string) => void;
  save: () => Promise<void>;
  reloadData: () => void; // New function to reload data
  getCoursesWithRecordsInRange: (startDate: string, endDate: string) => Promise<Course[]>;
  getPaginatedAttendanceRecords: (page: number, limit: number, courseId?: string, startDate?: string, endDate?: string) => void;
  attendanceRecords: AttendanceRecord[];
  totalRecords: number;
}

export const AppContext = createContext<AppContextType>({
  courses: [],
  loading: true,
  theme: "light",
  notificationTime: 10,
  notificationsEnabled: false,
  is24Hour: false,
  settings: {},
  updateSetting: () => { },
  toggle24Hour: () => { },
  updateNotificationTime: () => { },
  toggleTheme: () => { },
  toggleNotifications: () => { },
  addCourse: () => { },
  editCourse: () => { },
  getCourse: () => undefined,
  updateCourse: () => { },
  deleteCourse: () => { },
  changeAttendanceRecord: () => { },
  isValidCourseId: (courseId: string) => isValidCourseId(courseId),
  markAttendance: () => { },
  addScheduleItem: () => { },
  addExtraClass: () => { },
  clearData: () => { },
  recalculateCourseCounts: () => { },
  updateCourseCounts: () => { },
  archiveCourse: () => { },
  unarchiveCourse: () => { },
  upsertAttendance: () => { },
  save: () => Promise.resolve(),
  reloadData: () => { }, // Add default value for reloadData
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
  const [notificationTime, setNotificationTime] = useState(10);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [is24Hour, setIs24Hour] = useState(false);
  const [settings, setSettings] = useState<{ [key: string]: any }>({});
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const updateSetting = (key: string, value: any) => {
    db.updateSetting(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const loadData = () => {
    setLoading(true);
    try {
      const loadedSettings = db.getSettings();
      setSettings(loadedSettings);
      setTheme(loadedSettings.theme || 'light');
      setNotificationTime(parseInt(loadedSettings.notificationTime || '10', 10));
      setNotificationsEnabled(loadedSettings.notificationsEnabled === 'true');
      setIs24Hour(loadedSettings.is24Hour === 'true');

      const loadedCourses = db.getCourses();
      setCourses(loadedCourses);
      getPaginatedAttendanceRecords(currentPage, 10);
    } catch (error) {
      console.error("Failed to load data from database", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    db.initDatabase();
    createMissingAttendanceRecords();
    loadData();
  }, []);


  const toggle24Hour = () => {
    const newIs24Hour = !is24Hour;
    setIs24Hour(newIs24Hour);
    db.updateSetting('is24Hour', newIs24Hour.toString());
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    db.updateSetting('theme', newTheme);
  };

  const toggleNotifications = () => {
    const newNotificationsEnabled = !notificationsEnabled;
    setNotificationsEnabled(newNotificationsEnabled);
    db.updateSetting('notificationsEnabled', newNotificationsEnabled.toString());
  };

  const updateNotificationTime = (time: number) => {
    setNotificationTime(time);
    db.updateSetting('notificationTime', time.toString());
  };

  const addCourse = (newCourse: Course) => {
    const courseId = newCourse.id.trim();
    if (!isValidCourseId(courseId)) {
      // This should be handled by the form validation, but as a safeguard:
      console.error("Invalid course ID");
      return;
    }
    if (courses.some(c => c.id.toLowerCase() === courseId.toLowerCase())) {
      console.error("Course with this ID already exists.");
      return;
    }
    const courseWithInitializedCounters = {
      ...newCourse,
      requiredAttendance: newCourse.requiredAttendance || 75, // Ensure a default value
      attendanceRecords: newCourse.attendanceRecords || [],
      weeklySchedule: newCourse.weeklySchedule || [],
      extraClasses: newCourse.extraClasses || [],
      isArchived: false,
      createdAt: new Date().toISOString(),
    };
    db.addCourse(courseWithInitializedCounters);
    setCourses(prev => [...prev, courseWithInitializedCounters]);
  };

  const updateCourse = (updatedCourse: Course) => {
    console.log(`[CTX] Updating course: ${updatedCourse.name}`);
    db.updateCourse(updatedCourse);
    setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
  };

  const deleteCourse = async (courseId: string) => {
    console.log(`[CTX] Deleting course: ${courseId}`);
    await cancelCourseNotifications(courseId);
    db.deleteCourse(courseId);
    setCourses(prev => prev.filter(c => c.id !== courseId));
  };

  const _updateAttendance = (
    courseId: string,
    date: string,
    status: "present" | "absent" | "cancelled",
    isExtraClass: boolean,
    scheduleItemId: string | undefined,
    timeStart: string,
    timeEnd: string
  ) => {
    console.log(`[CTX] Updating attendance for course: ${courseId} on ${date}`);
    const course = courses.find(c => c.id === courseId);
    if (!course) {
      console.log(`[CTX] Course not found: ${courseId}`);
      return;
    }

    const existingRecord = course.attendanceRecords?.find(
      (record) =>
        record.date === date &&
        record.isExtraClass === isExtraClass &&
        record.scheduleItemId === scheduleItemId
    );

    if (existingRecord) {
      if (existingRecord.status === status) return; // No change

      db.deleteAttendanceRecord(existingRecord.id);
      const newRecord = { ...existingRecord, status };
      db.addAttendanceRecord(newRecord);

      const reloadedCourses = db.getCourses();
      setCourses(reloadedCourses);
    } else {
      const newRecord: AttendanceRecord = {
        id: `${courseId}-${scheduleItemId}-${date}`,
        course_id: courseId,
        date,
        status,
        isExtraClass,
        scheduleItemId,
        timeStart,
        timeEnd,
      };
      db.addAttendanceRecord(newRecord);
      const reloadedCourses = db.getCourses();
      setCourses(reloadedCourses);
    }
  };

  const markAttendance = (
    courseId: string,
    status: "present" | "absent" | "cancelled",
    isExtraClass: boolean,
    scheduleItemId: string | undefined,
    timeStart: string,
    timeEnd: string
  ) => {
    const todayDateString = format(new Date(), 'yyyy-MM-dd');
    _updateAttendance(courseId, todayDateString, status, isExtraClass, scheduleItemId, timeStart, timeEnd);
  };

  const changeAttendanceRecord = (courseId: string, recordId: string, newStatus: "present" | "absent" | "cancelled") => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const record = course.attendanceRecords?.find(r => r.id === recordId);
    if (!record || record.status === newStatus) return;

    db.deleteAttendanceRecord(record.id);
    const newRecord = { ...record, status: newStatus };
    db.addAttendanceRecord(newRecord);

    const reloadedCourses = db.getCourses();
    setCourses(reloadedCourses);
    getPaginatedAttendanceRecords(currentPage, 10);
  };

  const addScheduleItem = (courseId: string, newScheduleItem: ScheduleItem) => {
    console.log(`[CTX] Adding schedule item to course: ${courseId}`);
    db.addScheduleItem(courseId, newScheduleItem);
    const updatedCourses = courses.map(c => {
      if (c.id === courseId) {
        c.weeklySchedule = [...(c.weeklySchedule || []), newScheduleItem];
      }
      return c;
    });
    setCourses(updatedCourses);
  };

  const addExtraClass = (courseId: string, date: string, timeStart: string, timeEnd: string) => {
    console.log(`[CTX] Adding extra class to course: ${courseId}`);
    const newExtraClass: ExtraClass = {
      id: Date.now().toString(),
      date,
      timeStart,
      timeEnd,
    };
    db.addExtraClass(courseId, newExtraClass);
    const updatedCourses = courses.map(c => {
      if (c.id === courseId) {
        c.extraClasses = [...(c.extraClasses || []), newExtraClass];
      }
      return c;
    });
    setCourses(updatedCourses);
  };

  const clearData = () => {
    console.log('[CTX] Clearing all data');
    db.clearAllData();
    setCourses([]);
    setTheme('light');
    setNotificationTime(10);
    setNotificationsEnabled(false);
    setIs24Hour(false);
  };

  const archiveCourse = async (courseId: string) => {
    console.log(`[CTX] Archiving course: ${courseId}`);
    await cancelCourseNotifications(courseId);
    db.archiveCourse(courseId);
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, isArchived: true, archivedAt: new Date().toISOString() } : c));
  };

  const unarchiveCourse = async (courseId: string) => {
    console.log(`[CTX] Unarchiving course: ${courseId}`);
    const course = courses.find(c => c.id === courseId);
    if (course) {
      await scheduleCourseNotifications(course, notificationTime);
      db.unarchiveCourse(courseId);
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, isArchived: false, archivedAt: undefined } : c));
    }
  };

  const upsertAttendance = (courseId: string, scheduleId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean, timeStart: string, timeEnd: string, date: string) => {
    _updateAttendance(courseId, date, status, isExtraClass, scheduleId, timeStart, timeEnd);
  };

  const updateCourseCounts = (courseId: string, countType: "presents" | "absents" | "cancelled", newValue: number) => {
    console.log(`[CTX] Updating course counts for: ${courseId}`);
    const course = courses.find(c => c.id === courseId);
    if (course) {
      const updatedCourse = { ...course, [countType]: newValue };
      updatedCourse.attendancePercentage = calculateAttendancePercentage(updatedCourse.presents, updatedCourse.absents);
      updateCourse(updatedCourse);
    }
  };

  const recalculateCourseCounts = (courseId: string) => {
    const newCounts = db.recalculateCourseCounts(courseId);
    const reloadedCourses = db.getCourses();
    setCourses(reloadedCourses);
  };

  const save = async () => {
    // Save all settings
    db.updateSetting('theme', theme);
    db.updateSetting('notificationTime', notificationTime.toString());
    db.updateSetting('notificationsEnabled', notificationsEnabled.toString());
    db.updateSetting('is24Hour', is24Hour.toString());

    // Save all course data
    courses.forEach(course => {
      db.updateCourse(course);
    });
  };

  useEffect(() => {
    if (!loading) {
      const rescheduleAllNotifications = async () => {
        await cancelAllNotifications();
        for (const course of courses) {
          if (!course.isArchived) {
            await scheduleCourseNotifications(course, notificationTime);
          }
        }
      };
      rescheduleAllNotifications();
    }
  }, [courses, loading, notificationTime]);

  const getCoursesWithRecordsInRange = async (startDate: string, endDate: string): Promise<Course[]> => {
    setLoading(true);
    try {
      const loadedCourses = db.getCoursesWithRecordsInRange(startDate, endDate);
      return loadedCourses;
    } catch (error) {
      console.error("Failed to load courses with date range from database", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getPaginatedAttendanceRecords = (page: number, limit: number, courseId?: string, startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      setCurrentPage(page);
      const offset = (page - 1) * limit;
      const records = db.getAttendanceRecords(limit, offset, courseId, startDate, endDate);
      const total = db.getAttendanceRecordsCount(courseId, startDate, endDate);
      setAttendanceRecords(records);
      setTotalRecords(total);
    } catch (error) {
      console.error("Failed to load paginated attendance records from database", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        courses,
        loading,
        theme,
        notificationTime,
        notificationsEnabled,
        is24Hour,
        settings,
        updateSetting,
        toggle24Hour,
        updateNotificationTime,
        toggleTheme,
        toggleNotifications,
        addCourse,
        editCourse: updateCourse,
        getCourse: (courseId: string) => courses.find((course) => course.id === courseId),
        updateCourse,
        deleteCourse,
        changeAttendanceRecord,
        isValidCourseId,
        markAttendance,
        addScheduleItem,
        addExtraClass,
        clearData,
        archiveCourse,
        unarchiveCourse,
        upsertAttendance,
        updateCourseCounts,
        recalculateCourseCounts,
        save,
        reloadData: loadData, // Pass the reloadData function
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
