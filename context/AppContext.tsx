import { createContext, useState, useEffect, ReactNode } from "react";
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
  updateCourseCounts: (courseId: string, countType: "presents" | "absents" | "cancelled", newValue: number) => void;
  archiveCourse: (courseId: string) => void;
  unarchiveCourse: (courseId: string) => void;
  upsertAttendance: (courseId: string, scheduleId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean, timeStart: string, timeEnd: string, date: string) => void;
  save: () => Promise<void>;
  reloadData: () => void; // New function to reload data
  getCoursesWithRecordsInRange: (startDate: string, endDate: string) => Promise<Course[]>;
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
  updateCourseCounts: () => { },
  archiveCourse: () => { },
  unarchiveCourse: () => { },
  upsertAttendance: () => { },
  save: () => Promise.resolve(),
  reloadData: () => { }, // Add default value for reloadData
  getCoursesWithRecordsInRange: () => Promise.resolve([]),
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

  useEffect(() => {
    if (!loading) {
      const colorPalette = [
        '#F08080', '#ADD8E6', '#6495ED', '#FFBF00', '#DE3163',
        '#DA70D6', '#CCCCFF', '#FF7F50', '#FFC0CB', '#FFA07A'
      ];
      const allCourseIds = courses.map(c => c.id);
      courses.forEach(course => {
        if (!course.color) {
          const index = allCourseIds.indexOf(course.id);
          const color = colorPalette[index % colorPalette.length];
          const updatedCourse = { ...course, color };
          db.updateCourse(updatedCourse);
          setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
        }
      });
    }
  }, [loading]);

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
    db.updateCourse(updatedCourse);
    setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
  };

  const deleteCourse = async (courseId: string) => {
    await cancelCourseNotifications(courseId);
    db.deleteCourse(courseId);
    setCourses(prev => prev.filter(c => c.id !== courseId));
  };

  const markAttendance = (
    courseId: string,
    status: "present" | "absent" | "cancelled",
    isExtraClass: boolean,
    scheduleItemId: string | undefined,
    timeStart: string,
    timeEnd: string
  ) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const todayDateString = new Date().toISOString().slice(0, 10);
    const existingRecord = course.attendanceRecords?.find(
      (record) =>
        record.date === todayDateString &&
        record.isExtraClass === isExtraClass &&
        record.scheduleItemId === scheduleItemId
    );

    const updatedCourse = { ...course };
    let oldStatus: AttendanceRecord['status'] | undefined = undefined;

    if (existingRecord) {
      oldStatus = existingRecord.status;
      if (oldStatus !== status) {
        existingRecord.status = status;
        db.updateAttendanceRecord(existingRecord); // Update the record in the DB

        // Decrement the old status count and increment the new one
        if (oldStatus) {
          const key = (oldStatus === 'cancelled' ? 'cancelled' : oldStatus + 's') as keyof Course;
          (updatedCourse[key] as number) = ((updatedCourse[key] as number) || 0) - 1;
        }
        const newKey = (status === 'cancelled' ? 'cancelled' : status + 's') as keyof Course;
        (updatedCourse[newKey] as number) = ((updatedCourse[newKey] as number) || 0) + 1;

      } else {
        return; // No change
      }
    } else {
      const newRecord: AttendanceRecord = {
        id: Date.now().toString(),
        course_id: courseId,
        date: new Date().toISOString().slice(0, 10),
        status: status,
        isExtraClass: isExtraClass,
        scheduleItemId: scheduleItemId,
        timeStart,
        timeEnd,
      };
      updatedCourse.attendanceRecords = [...(updatedCourse.attendanceRecords || []), newRecord];
      db.addAttendanceRecord(newRecord);

      // Increment the new status count
      const newKey = (status === 'cancelled' ? 'cancelled' : status + 's') as keyof Course;
      (updatedCourse[newKey] as number) = ((updatedCourse[newKey] as number) || 0) + 1;
    }

    // Recalculate attendance percentage
    updatedCourse.attendancePercentage = calculateAttendancePercentage(updatedCourse.presents, updatedCourse.absents);

    updateCourse(updatedCourse);
  };

  const changeAttendanceRecord = (courseId: string, recordId: string, newStatus: "present" | "absent" | "cancelled") => {
    const course = courses.find(c => c.id === courseId);
    if (!course || !course.attendanceRecords) return;

    const record = course.attendanceRecords.find(r => r.id === recordId);
    if (!record) return;

    const oldStatus = record.status;
    if (oldStatus === newStatus) return;

    const updatedCourse = { ...course };

    // Decrement the old status count and increment the new one
    const oldKey = (oldStatus === 'cancelled' ? 'cancelled' : oldStatus + 's') as keyof Course;
    (updatedCourse[oldKey] as number) = ((updatedCourse[oldKey] as number) || 0) - 1;
    const newKey = (newStatus === 'cancelled' ? 'cancelled' : newStatus + 's') as keyof Course;
    (updatedCourse[newKey] as number) = ((updatedCourse[newKey] as number) || 0) + 1;

    record.status = newStatus;
    db.updateAttendanceRecord(record);

    // Recalculate attendance percentage
    updatedCourse.attendancePercentage = calculateAttendancePercentage(updatedCourse.presents, updatedCourse.absents);

    updateCourse(updatedCourse);
  };

  const addScheduleItem = (courseId: string, newScheduleItem: ScheduleItem) => {
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
    db.clearAllData();
    setCourses([]);
    setTheme('light');
    setNotificationTime(10);
    setNotificationsEnabled(false);
    setIs24Hour(false);
  };

  const archiveCourse = async (courseId: string) => {
    await cancelCourseNotifications(courseId);
    const course = courses.find(c => c.id === courseId);
    if (course) {
      const updatedCourse = { ...course, isArchived: true, archivedAt: new Date().toISOString() };
      updateCourse(updatedCourse);
    }
  };

  const unarchiveCourse = async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      await scheduleCourseNotifications(course, notificationTime);
      const updatedCourse = { ...course, isArchived: false, archivedAt: undefined };
      updateCourse(updatedCourse);
    }
  };

  const upsertAttendance = (courseId: string, scheduleId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean, timeStart: string, timeEnd: string, date: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
  
    const existingRecord = course.attendanceRecords?.find(
      r => r.date === date && r.scheduleItemId === scheduleId && r.isExtraClass === isExtraClass
    );
  
    if (existingRecord) {
      // This is an update
      changeAttendanceRecord(courseId, existingRecord.id, status);
    } else {
      // This is an insert
      const newRecord: AttendanceRecord = {
        id: `${Date.now()}-${Math.random()}`, // More robust unique ID
        course_id: courseId,
        date: date,
        status: status,
        isExtraClass: isExtraClass,
        scheduleItemId: scheduleId,
        timeStart,
        timeEnd,
      };
      db.addAttendanceRecord(newRecord);
  
      const updatedCourse = { ...course };
      updatedCourse.attendanceRecords = [...(updatedCourse.attendanceRecords || []), newRecord];
      
      // Manually update counts
      const key = (status === 'cancelled' ? 'cancelled' : status + 's') as keyof Course;
      (updatedCourse[key] as number) = ((updatedCourse[key] as number) || 0) + 1;
      updatedCourse.attendancePercentage = calculateAttendancePercentage(updatedCourse.presents, updatedCourse.absents);
  
      updateCourse(updatedCourse);
    }
  };

  const updateCourseCounts = (courseId: string, countType: "presents" | "absents" | "cancelled", newValue: number) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      const updatedCourse = { ...course, [countType]: newValue };
      updatedCourse.attendancePercentage = calculateAttendancePercentage(updatedCourse.presents, updatedCourse.absents);
      updateCourse(updatedCourse);
    }
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
        save,
        reloadData: loadData, // Pass the reloadData function
        getCoursesWithRecordsInRange,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
