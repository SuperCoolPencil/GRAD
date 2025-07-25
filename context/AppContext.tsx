import { createContext, useState, useEffect, ReactNode } from "react";
import { CustomAlert } from "../components/CustomAlert";
import { Course, AttendanceRecord, ScheduleItem, ExtraClass } from "../types";
import { cancelAllNotifications, cancelCourseNotifications, scheduleCourseNotifications } from "@/utils/notifications";
import * as db from '../utils/database';
import { calculateAttendancePercentage } from "@/utils/attendance";

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
    scheduleItemId?: string
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
  addAttendance: (courseId: string, scheduleId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean) => void;
  save: () => Promise<void>;
}

export const AppContext = createContext<AppContextType>({
  courses: [],
  loading: true,
  theme: "light",
  notificationTime: 10,
  notificationsEnabled: false,
  is24Hour: false,
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
  addAttendance: () => { },
  save: () => Promise.resolve(),
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

  useEffect(() => {
    const loadData = () => {
      try {
        const settings = db.getSettings();
        setTheme(settings.theme || 'light');
        setNotificationTime(parseInt(settings.notificationTime || '10', 10));
        setNotificationsEnabled(settings.notificationsEnabled === 'true');
        setIs24Hour(settings.is24Hour === 'true');

        const loadedCourses = db.getCourses();
        setCourses(loadedCourses);
      } catch (error) {
        console.error("Failed to load data from database", error);
      } finally {
        setLoading(false);
      }
    };
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
    scheduleItemId?: string
  ) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const todayDateString = new Date().toISOString().slice(0, 10);
    const existingRecord = course.attendanceRecords?.find(
      (record) =>
        new Date(record.date).toISOString().slice(0, 10) === todayDateString &&
        record.isExtraClass === isExtraClass &&
        record.scheduleItemId === scheduleItemId
    );

    const updatedCourse = { ...course };
    let oldStatus: AttendanceRecord['status'] | undefined = undefined;

    if (existingRecord) {
      oldStatus = existingRecord.status;
      if (oldStatus !== status) {
        existingRecord.status = status;
      } else {
        return; // No change
      }
    } else {
      const newRecord: AttendanceRecord = {
        id: Date.now().toString(),
        course_id: courseId,
        date: new Date().toISOString(),
        status: status,
        isExtraClass: isExtraClass,
        scheduleItemId: scheduleItemId,
      };
      updatedCourse.attendanceRecords = [...(updatedCourse.attendanceRecords || []), newRecord];
      db.addAttendanceRecord(newRecord);
    }

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
    record.status = newStatus;

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
      const updatedCourse = { ...course, isArchived: true };
      updateCourse(updatedCourse);
    }
  };

  const unarchiveCourse = async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      await scheduleCourseNotifications(course, notificationTime);
      const updatedCourse = { ...course, isArchived: false };
      updateCourse(updatedCourse);
    }
  };

  const addAttendance = (courseId: string, scheduleId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const newRecord: AttendanceRecord = {
      id: Date.now().toString(),
      course_id: courseId,
      date: new Date().toISOString(),
      status: status,
      isExtraClass: isExtraClass,
      scheduleItemId: scheduleId,
    };
    db.addAttendanceRecord(newRecord);

    const updatedCourse = { ...course };
    updatedCourse.attendanceRecords = [...(updatedCourse.attendanceRecords || []), newRecord];

    updateCourse(updatedCourse);
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

  return (
    <AppContext.Provider
      value={{
        courses,
        loading,
        theme,
        notificationTime,
        notificationsEnabled,
        is24Hour,
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
        addAttendance,
        updateCourseCounts,
        save,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
