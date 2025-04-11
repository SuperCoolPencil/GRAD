import { createContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Course, AttendanceRecord, ScheduleItem } from '../types';

interface AppContextType {
    courses: Course[];
    loading: boolean;
    theme: string;
    toggleTheme: () => void;
    addCourse: (newCourse: Course) => void;
    updateCourse: (updatedCourse: Course) => void;
    deleteCourse: (courseId: string) => void;
    markAttendance: (courseId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean, scheduleItemId?: string) => void;
    addScheduleItem: (courseId: string, newScheduleItem: ScheduleItem) => void;
    clearData: () => void;
}

export const AppContext = createContext<AppContextType>({
    courses: [],
    loading: true,
    theme: 'light',
    toggleTheme: () => { },
    addCourse: () => { },
    updateCourse: () => { },
    deleteCourse: () => { },
    markAttendance: () => { },
    addScheduleItem: () => { },
    clearData: () => { },
});

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);
    const [theme, setTheme] = useState<string>('light');

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                const storedCourses = await AsyncStorage.getItem('courses');
                const storedTheme = await AsyncStorage.getItem('theme');
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
                await AsyncStorage.setItem('courses', JSON.stringify(courses));
                await AsyncStorage.setItem('theme', theme);
            } catch (error) {
                console.error("Failed to save data", error);
            }
        };

        if (!loading) {
            saveData();
        }
    }, [courses, loading, theme]);

    const addCourse = (newCourse: Course) => {
        setCourses(prevCourses => [...prevCourses, newCourse]);
    };

    const updateCourse = (updatedCourse: Course) => {
        setCourses(prevCourses =>
            prevCourses.map(course =>
                course.id === updatedCourse.id ? updatedCourse : course));
    };

    const deleteCourse = (courseId: string) => {
        setCourses(prevCourses =>
            prevCourses.filter(course =>
                course.id !== courseId));
    };

    const markAttendance = (
        courseId: string,
        status: 'present' | 'absent' | 'cancelled',
        isExtraClass: boolean,
        scheduleItemId?: string
    ) => {
        setCourses(prevCourses =>
            prevCourses.map((course) => {
                if (course.id === courseId) {
                    const updatedCourse = { ...course };

                    // Find if an attendance record exists for the current day and schedule item
                    const existingRecordIndex = updatedCourse.attendanceRecords?.findIndex(
                        record =>
                            new Date(record.data).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) &&
                            record.isExtraClass === isExtraClass &&
                            record.scheduleItemId === scheduleItemId
                    ) ?? -1;

                    if (existingRecordIndex > -1 && updatedCourse.attendanceRecords) {
                        // Update the existing record
                        updatedCourse.attendanceRecords[existingRecordIndex] = {
                            ...updatedCourse.attendanceRecords[existingRecordIndex],
                            Status: status,
                        };
                    } else {
                        // Create a new attendance record
                        const newRecord: AttendanceRecord = {
                            id: Date.now().toString(),
                            data: new Date().toISOString(),
                            Status: status,
                            isExtraClass,
                            scheduleItemId: scheduleItemId,
                        };

                        // Add the new record to the attendance records
                        updatedCourse.attendanceRecords = updatedCourse.attendanceRecords ? [
                            ...updatedCourse.attendanceRecords,
                            newRecord,
                        ] : [newRecord];
                    }

                    // Recalculate counters
                    updatedCourse.presents = updatedCourse.attendanceRecords?.filter(r => r.Status === 'present').length || 0;
                    updatedCourse.absents = updatedCourse.attendanceRecords?.filter(r => r.Status === 'absent').length || 0;
                    updatedCourse.cancelled = updatedCourse.attendanceRecords?.filter(r => r.Status === 'cancelled').length || 0;

                    console.log("markAttendance", {
                        courseId,
                        status,
                        isExtraClass,
                        scheduleItemId,
                        updatedCourse
                    });

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
        setCourses(prevCourses =>
            prevCourses.map(course => {
                if (course.id === courseId) {
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
    }

    const clearData = async () => {
        try {
            await AsyncStorage.removeItem('courses');
            await AsyncStorage.removeItem('theme');
            setCourses([]);
            setTheme('light');
        } catch (error) {
            console.error("Failed to clear data", error);
        }
    };

    useEffect(() => {
        const saveTheme = async () => {
            try {
                await AsyncStorage.setItem('theme', theme);
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
                updateCourse,
                deleteCourse,
                markAttendance,
                addScheduleItem: addScheduleItem,
                clearData,
            }}
        >
            {children}
        </AppContext.Provider>
    );
}
