import {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useContext, // Added for accessing context within provider if needed later
} from "react";
import { Platform, Alert } from "react-native"; // Added Platform and Alert
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications"; // Added expo-notifications import
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
  archiveCourse: (courseId: string) => void; // Add archive function type
  unarchiveCourse: (courseId: string) => void; // Add unarchive function type
  scheduleClassReminders: () => Promise<void>; // Add type for scheduling function
}

// Define the category identifier
const CLASS_REMINDER_CATEGORY_ID = "CLASS_REMINDER";

export const AppContext = createContext<AppContextType>({
  courses: [],
  loading: true,
  theme: "light",
  toggleTheme: () => { },
  addCourse: () => { },
  editCourse: () => { },
  getCourse: () => Promise.resolve(undefined),
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
  scheduleClassReminders: async () => {}, // Add default empty function
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
      // Schedule reminders whenever courses change and data is loaded
      scheduleClassReminders(); // Now defined above, so accessible
    }
  }, [courses, loading, theme]);

  // Define scheduleClassReminders function *before* useEffect hooks that might use it
  const scheduleClassReminders = async () => {
    console.log("Attempting to schedule class reminders...");
    await Notifications.cancelAllScheduledNotificationsAsync(); // Clear old notifications first
    console.log("Cancelled previous notifications.");

    const now = new Date();
    const scheduledIdentifiers = new Set<string>(); // Keep track of scheduled notifications

    courses.forEach(course => {
      if (course.isArchived) return; // Skip archived courses

      // Schedule for weekly classes
      (course.weeklySchedule || []).forEach(item => {
        const [hours, minutes] = item.timeStart.split(':').map(Number);
        const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(item.day);

        // Calculate the next occurrence of this day and time
        let nextClassDate = new Date(now);
        nextClassDate.setDate(now.getDate() + ((dayOfWeek - now.getDay() + 7) % 7)); // Move to the correct day of the week
        nextClassDate.setHours(hours, minutes, 0, 0); // Set the time

        // If the calculated time is in the past for today, schedule for next week
        if (nextClassDate <= now) {
           nextClassDate.setDate(nextClassDate.getDate() + 7);
        }

        // Schedule reminder 15 minutes before
        const reminderTime = new Date(nextClassDate.getTime() - 15 * 60 * 1000); // 15 minutes before

        // Only schedule if the reminder time is in the future
        if (reminderTime > now) {
          const identifier = `${course.id}-weekly-${item.id}-${reminderTime.toISOString()}`; // Unique identifier
          if (!scheduledIdentifiers.has(identifier)) {
            Notifications.scheduleNotificationAsync({
              content: {
                title: `Class Reminder: ${course.name}`,
                body: `Your class starts at ${item.timeStart}.`,
                data: { courseId: course.id, scheduleItemId: item.id, isExtraClass: false },
                categoryIdentifier: CLASS_REMINDER_CATEGORY_ID,
              },
              trigger: reminderTime as any, // Cast Date to any to bypass TS error
              identifier: identifier, // Add identifier here
            });
            scheduledIdentifiers.add(identifier);
            console.log(`Scheduled weekly reminder for ${course.name} at ${reminderTime}`);
          }
        }
      });

      // Schedule for extra classes
      (course.extraClasses || []).forEach(extra => {
        const [year, month, day] = extra.date.split('-').map(Number);
        const [hours, minutes] = extra.timeStart.split(':').map(Number);
        const classDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

        // Schedule reminder 15 minutes before
        const reminderTime = new Date(classDateTime.getTime() - 15 * 60 * 1000); // 15 minutes before

        // Only schedule if the reminder time is in the future
        if (reminderTime > now) {
           const identifier = `${course.id}-extra-${extra.id}-${reminderTime.toISOString()}`; // Unique identifier
           if (!scheduledIdentifiers.has(identifier)) {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: `Extra Class Reminder: ${course.name}`,
                  body: `Your extra class starts at ${extra.timeStart} on ${extra.date}.`,
                  data: { courseId: course.id, scheduleItemId: extra.id, isExtraClass: true }, // Use extra.id as scheduleItemId here
                categoryIdentifier: CLASS_REMINDER_CATEGORY_ID,
              },
              trigger: reminderTime as any, // Cast Date to any to bypass TS error
              identifier: identifier, // Add identifier here
            });
            scheduledIdentifiers.add(identifier);
              console.log(`Scheduled extra class reminder for ${course.name} at ${reminderTime}`);
           }
        }
      });
    });
    console.log("Finished scheduling reminders.");
  };

  // --- Notification Setup Effect ---
  useEffect(() => {
    const setupNotifications = async () => {
      // 1. Request Permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Permission Required', 'Failed to get push token for push notification!');
        return;
      }

      // 2. Android Channel (Important!)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      // 3. Define Actionable Category
      await Notifications.setNotificationCategoryAsync(CLASS_REMINDER_CATEGORY_ID, [
        {
          identifier: 'present',
          buttonTitle: 'Present',
          options: {
            opensAppToForeground: false, // Keep app in background if possible
          },
        },
        {
          identifier: 'absent',
          buttonTitle: 'Absent',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'cancelled',
          buttonTitle: 'Cancelled',
          options: {
            // Destructive action styling might be available on some platforms
            // isDestructive: true, // Example, check expo-notifications docs
            opensAppToForeground: false,
          },
        },
      ]);

      console.log("Notification permissions granted and category set up.");
    };

    setupNotifications();

    // --- Notification Response Handler ---
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification Response:', JSON.stringify(response, null, 2)); // Log the full response

      const actionIdentifier = response.actionIdentifier;
      const notificationData = response.notification.request.content.data;

      console.log('Action Identifier:', actionIdentifier);
      console.log('Notification Data:', notificationData);
      console.log('Notification Data scheduleItemId:', notificationData.scheduleItemId); // ADDED

      if (notificationData && notificationData.courseId && notificationData.scheduleItemId !== undefined) { // Ensure necessary data exists
        const { courseId, scheduleItemId, isExtraClass } = notificationData as { courseId: string; scheduleItemId: string | undefined; isExtraClass: boolean }; // Type assertion
        console.log('Extracted scheduleItemId:', scheduleItemId); // ADDED

        if (actionIdentifier === 'present' || actionIdentifier === 'absent' || actionIdentifier === 'cancelled') {
          console.log(`Calling markAttendance for ${courseId}, status: ${actionIdentifier}, isExtra: ${isExtraClass}, scheduleId: ${scheduleItemId}`);
          // Directly call markAttendance - Need to ensure it's accessible here
          // This might require restructuring or passing markAttendance down if it's not directly in scope
          // For now, assuming it might be accessible via context or needs adjustment
          // **Potential Issue:** markAttendance might not be directly callable here without context access or refactoring.
          // We will address this when implementing the scheduling part.
          // For now, let's log the intent.
           Alert.alert(
             "Attendance Action",
             `Action "${actionIdentifier}" received for course ${courseId}. (Implementation pending context access)`
           );
           // Call markAttendance directly
           markAttendance(courseId, actionIdentifier as "present" | "absent" | "cancelled", isExtraClass, scheduleItemId);
           // Provide visual feedback (optional, but good UX)
           Alert.alert("Attendance Updated", `Status for ${courseId} set to ${actionIdentifier}.`);
        } else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          console.log('Notification tapped (default action)');
          // Handle default tap if needed (e.g., navigate to course screen)
        }
      } else {
        console.warn('Received notification response without expected data:', notificationData);
      }
    });

    // Cleanup listener on unmount
    return () => {
      Notifications.removeNotificationSubscription(notificationResponseSubscription);
    };

  }, []); // Run only once on mount

  const addCourse = (newCourse: Course) => {
    const courseId = newCourse.id.trim();
    if (!isValidCourseId(courseId)) {
      <CustomAlert
        title="Error"
        message="Course ID must contain only numbers and alphabets."
        isVisible={true}
        onClose={() => { }}
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
        onClose={() => { }}
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
      attendancePercentage: 100,
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

          // Calculate attendance percentage
          const totalClasses = updatedCourse.presents + updatedCourse.absents;
          updatedCourse.attendancePercentage =
            totalClasses === 0
              ? 100
              : Math.round((updatedCourse.presents / totalClasses) * 100);

          // Ensure attendancePercentage is not NaN
          updatedCourse.attendancePercentage = isNaN(updatedCourse.attendancePercentage) ? 100 : updatedCourse.attendancePercentage;

          return updatedCourse;
        }
        return course;
      })
    );
  };

  const changeAttendanceRecord = (courseId: string, recordId: string, newStatus: "present" | "absent" | "cancelled") => {
    setCourses((prevCourses) =>
      prevCourses.map((course) => {
        if (course.id.toLowerCase() === courseId.toLowerCase()) {
          const updatedCourse = { ...course };
          const updatedRecords = updatedCourse.attendanceRecords?.map(record => {
            if (record.id === recordId) {
              return { ...record, Status: newStatus };
            }
            return record;
          });

          // Update presents, absents, cancelled counts
          let presents = updatedCourse.presents || 0;
          let absents = updatedCourse.absents || 0;
          let cancelled = updatedCourse.cancelled || 0;

          const oldRecord = updatedCourse.attendanceRecords?.find(r => r.id === recordId);
          const oldStatus = oldRecord ? oldRecord.Status : null;

          updatedRecords?.forEach(record => {
            if (record.id === recordId) {
              if (oldStatus === 'present') presents--;
              else if (oldStatus === 'absent') absents--;
              else if (oldStatus === 'cancelled') cancelled--;

              presents = Math.max(0, presents);
              absents = Math.max(0, absents);
              cancelled = Math.max(0, cancelled);

              if (record.Status === 'present') presents++;
              else if (record.Status === 'absent') absents++;
              else if (record.Status === 'cancelled') cancelled++;


            }
          });

          updatedCourse.attendanceRecords = updatedRecords;
          updatedCourse.presents = presents;
          updatedCourse.absents = absents;
          updatedCourse.cancelled = cancelled;

          // Calculate attendance percentage
          const totalClasses = updatedCourse.presents + updatedCourse.absents;
          updatedCourse.attendancePercentage =
            totalClasses === 0
              ? 100
              : Math.round((updatedCourse.presents / totalClasses) * 100);

          // Ensure attendancePercentage is not NaN
          updatedCourse.attendancePercentage = isNaN(updatedCourse.attendancePercentage) ? 100 : updatedCourse.attendancePercentage;

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

  const archiveCourse = (courseId: string) => {
    setCourses((prevCourses) =>
      prevCourses.map((course) =>
        course.id.toLowerCase() === courseId.toLowerCase()
          ? { ...course, isArchived: true }
          : course
      )
    );
  };

  const unarchiveCourse = (courseId: string) => {
    setCourses((prevCourses) =>
      prevCourses.map((course) =>
        course.id.toLowerCase() === courseId.toLowerCase()
          ? { ...course, isArchived: false }
          : course
      )
    );
  }

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
        changeAttendanceRecord,
        isValidCourseId,
        markAttendance,
        addScheduleItem: addScheduleItem,
        addExtraClass: addExtraClass,
        clearData,
        archiveCourse, // Add archive function to context value
        unarchiveCourse,
        scheduleClassReminders, // Pass the function defined above
        updateCourseCounts: (courseId: string, countType: "presents" | "absents" | "cancelled", newValue: number) => {
          setCourses((prevCourses) =>
            prevCourses.map((course) => {
              if (course.id.toLowerCase() === courseId.toLowerCase()) {
                const updatedCourse = { ...course };
                updatedCourse[countType] = newValue;

                // Calculate attendance percentage
                const totalClasses = updatedCourse.presents + updatedCourse.absents;
                updatedCourse.attendancePercentage =
                  totalClasses === 0
                    ? 100
                    : Math.round((updatedCourse.presents / totalClasses) * 100);

                // Ensure attendancePercentage is not NaN
                updatedCourse.attendancePercentage = isNaN(updatedCourse.attendancePercentage) ? 100 : updatedCourse.attendancePercentage;

                return updatedCourse;
              }
              return course;
            })
          );
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
