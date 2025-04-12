import {
  createContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CustomAlert } from "../components/CustomAlert";
import { Course, AttendanceRecord, ScheduleItem, ExtraClass } from "../types";

const isValidCourseId = (courseId: string) => {
  const regex = /^[a-zA-Z0-9]*$/;
  return regex.test(courseId);
};

interface AppContextType {
  courses: Course[];
  loading: boolean;
  theme: string;
  toggleTheme: () => void;
  addCourse: (newCourse: Course) => void;
  editCourse: (updatedCourse: Course) => void;
  getCourse: (courseId: string) => Promise<Course | undefined>;
  updateCourse: (updatedCourse: Course) => void;
  deleteCourse: (courseId: string) => void;
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
}

export const AppContext = createContext<AppContextType>({
  courses: [],
  loading: true,
  theme: "light",
  toggleTheme: () => {},
  addCourse: () => {},
  editCourse: () => {},
   getCourse: () => Promise.resolve(undefined),
  updateCourse: () => {},
  deleteCourse: () => {},
  isValidCourseId: (courseId: string) => isValidCourseId(courseId),
  markAttendance: () => {},
  addScheduleItem: () => {},
  addExtraClass: () => {},
  clearData: () => {},
});

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [theme, setTheme] = useState<string>("light");

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedCourses = await AsyncStorage.getItem("courses");
        const storedTheme = await AsyncStorage.getItem("theme");
        if (storedCourses) {
          setCourses(JSON.parse(storedCourses));
        }
        if (storedTheme) {
          setTheme(storedTheme);
        }
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        await AsyncStorage.setItem("courses", JSON.stringify(courses));
        await AsyncStorage.setItem("theme", theme);
      } catch (error) {
        console.error("Failed to save data", error);
      }
    };

    if (!loading) {
      saveData();
    }
  }, [courses, loading, theme]);

  const [isAddCourseAlertVisible, setIsAddCourseAlertVisible] = useState(false);

  const addCourse = (newCourse: Course) => {
    const courseId = newCourse.id.trim();
    if (!isValidCourseId(courseId)) {
      <CustomAlert
        title="Error"
        message="Course ID must contain only numbers and alphabets."
        isVisible={true}
        onClose={() => {}}
      />
      return;
    }
    const existingCourse = courses.find(
      (course) => course.id.toLowerCase() === courseId.toLowerCase()
    );
    if (existingCourse) {
      <CustomAlert
        title="Error"
        message="A course with this ID already exists. Please use a different ID."
        isVisible={true}
        onClose={() => {}}
      />
      return;
    }
    // Ensure counters are initialized when adding a course
    const courseWithInitializedCounters = {
      ...newCourse,
      presents: newCourse.presents || 0,
      absents: newCourse.absents || 0,
      cancelled: newCourse.cancelled || 0,
      attendanceRecords: newCourse.attendanceRecords || [],
      weeklySchedule: newCourse.weeklySchedule || [],
      extraClasses: newCourse.extraClasses || [],
    };
    setCourses((prevCourses) => [...prevCourses, courseWithInitializedCounters]);
    return;
  };

  const [isUpdateCourseAlertVisible, setIsUpdateCourseAlertVisible] = useState(false);

  const updateCourse = (updatedCourse: Course) => {
    const courseId = updatedCourse.id.trim();
    if (!isValidCourseId(courseId)) {
      <CustomAlert
        title="Error"
        message="Course ID must contain only numbers and alphabets."
        isVisible={isUpdateCourseAlertVisible}
        onClose={() => setIsUpdateCourseAlertVisible(false)}
      />
      return;
    }
    const existingCourse = courses.find(
      (course) => course.id.toLowerCase() === courseId.toLowerCase() && course.id.toLowerCase() !== updatedCourse.id.toLowerCase()
    );
    if (existingCourse) {
      <CustomAlert
        title="Error"
        message="A course with this ID already exists. Please use a different ID."
        isVisible={isUpdateCourseAlertVisible}
        onClose={() => setIsUpdateCourseAlertVisible(false)}
      />
      return;
    }
    setCourses((prevCourses) =>
      prevCourses.map((course) =>
        course.id.toLowerCase() === updatedCourse.id.toLowerCase() ? updatedCourse : course
      )
    );
  };

  const deleteCourse = (courseId: string) => {
    setCourses((prevCourses) =>
      prevCourses.filter((course) => course.id.toLowerCase() !== courseId.toLowerCase())
    );
  };

  const [isMarkAttendanceAlertVisible, setIsMarkAttendanceAlertVisible] = useState(false);

  const markAttendance = (
    courseId: string,
    status: "present" | "absent" | "cancelled",
    isExtraClass: boolean,
    scheduleItemId?: string
  ) => {
    setCourses((prevCourses) =>
      prevCourses.map((course) => {
        if (course.id.toLowerCase() === courseId.toLowerCase()) {
          // Ensure counters exist, default to 0 if not
          const currentPresents = course.presents || 0;
          const currentAbsents = course.absents || 0;
          const currentCancelled = course.cancelled || 0;
          const currentAttendanceRecords = course.attendanceRecords || [];

          const updatedCourse = {
             ...course,
             presents: currentPresents,
             absents: currentAbsents,
             cancelled: currentCancelled,
             attendanceRecords: [...currentAttendanceRecords] // Clone to avoid direct mutation
           };

          // Find if an attendance record exists for the current day and schedule item
          const todayDateString = new Date().toISOString().slice(0, 10);
          const existingRecordIndex =
            updatedCourse.attendanceRecords.findIndex(
              (record) =>
                new Date(record.data).toISOString().slice(0, 10) === todayDateString &&
                record.isExtraClass === isExtraClass &&
                record.scheduleItemId === scheduleItemId // scheduleItemId identifies the specific class instance
            );

          let oldStatus: AttendanceRecord['Status'] | undefined = undefined;

          if (existingRecordIndex > -1) {
            // Record exists, update it
            oldStatus = updatedCourse.attendanceRecords[existingRecordIndex].Status;
            // Only update if the status is actually different
            if (oldStatus !== status) {
              updatedCourse.attendanceRecords[existingRecordIndex] = {
                ...updatedCourse.attendanceRecords[existingRecordIndex],
                Status: status,
              };
            } else {
              // Status is the same, no change needed in counters or record
              return course; // Return original course object if no change
            }
          } else {
            // No existing record, create a new one
            const newRecord: AttendanceRecord = {
              id: Date.now().toString(), // Consider a more robust unique ID if needed
              data: new Date().toISOString(),
              Status: status,
              isExtraClass: isExtraClass,
              scheduleItemId: scheduleItemId,
            };
            updatedCourse.attendanceRecords.push(newRecord);
            // oldStatus remains undefined
          }

          // --- Incremental Counter Update Logic ---
          // Decrement count for the old status (if it existed and changed)
          if (oldStatus && oldStatus !== status) {
            if (oldStatus === 'present') updatedCourse.presents--;
            else if (oldStatus === 'absent') updatedCourse.absents--;
            else if (oldStatus === 'cancelled') updatedCourse.cancelled--;
          }

          // Increment count for the new status (if it changed or is new)
          if (oldStatus !== status) {
             if (status === 'present') updatedCourse.presents++;
             else if (status === 'absent') updatedCourse.absents++;
             else if (status === 'cancelled') updatedCourse.cancelled++;
          }
          // --- End Incremental Counter Update ---

          // Ensure counters don't go below zero (safety check)
          updatedCourse.presents = Math.max(0, updatedCourse.presents);
          updatedCourse.absents = Math.max(0, updatedCourse.absents);
          updatedCourse.cancelled = Math.max(0, updatedCourse.cancelled);

          return updatedCourse;
        }
        return course;
      })
    );
  };

  const addScheduleItem = (
    courseId: string,
    newScheduleItem: ScheduleItem
  ) => {
    setCourses((prevCourses) =>
      prevCourses.map((course) => {
        if (course.id.toLowerCase() === courseId.toLowerCase()) {
          const updatedCourse = { ...course };
          updatedCourse.weeklySchedule = [
            ...(course.weeklySchedule || []),
            newScheduleItem,
          ];
          return updatedCourse;
        }
        return course;
      })
    );
  };

  const addExtraClass = (
    courseId: string,
    date: string,
    timeStart: string,
    timeEnd: string
  ) => {
      setCourses((prevCourses) => {
      return prevCourses.map((course) => {
        if (course.id.toLowerCase() === courseId.toLowerCase()) {
          const updatedCourse = { ...course };
          const newExtraClass: ExtraClass = {
            id: Date.now().toString(),
            date: date,
            timeStart: timeStart,
            timeEnd: timeEnd,
          };
          updatedCourse.extraClasses = [
            ...(course.extraClasses || []),
            newExtraClass,
          ];
          return updatedCourse;
        }
        return course;
      });
    }
    );
  };

  const clearData = async () => {
    try {
      await AsyncStorage.removeItem("courses");
      await AsyncStorage.removeItem("theme");
      setCourses([]);
      setTheme("light");
    } catch (error) {
      console.error("Failed to clear data", error);
    }
  };

  useEffect(() => {
    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem("theme", theme);
      } catch (error) {
        console.error("Failed to save theme", error);
      }
    };

    saveTheme();
  }, [theme]);

  return (
    <AppContext.Provider
      value={{
        courses,
        loading,
        theme,
        toggleTheme,
        addCourse,
  editCourse: updateCourse,
  getCourse: (courseId: string) => {
    return Promise.resolve(courses.find((course) => course.id === courseId));
  },
  updateCourse,
  deleteCourse,
  isValidCourseId,
  markAttendance,
  addScheduleItem: addScheduleItem,
  addExtraClass: addExtraClass,
  clearData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
