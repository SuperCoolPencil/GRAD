import { createContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Course, AttendanceRecord, ScheduleItem } from '../types';

interface AppContextType {
    courses: Course[];
    loading: boolean;
    addCourse: (newCourse: Course) => void;
    updateCourse: (updatedCourse: Course) => void;
    deleteCourse: (courseId: string) => void;
    markAttendance: (courseId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean) => void;
    addScheduleItem: (courseId: string, newScheduleItem: ScheduleItem) => void;
}

export const AppContext = createContext<AppContextType>({
    courses: [],
    loading: true,
    addCourse: () => { },
    updateCourse: () => { },
    deleteCourse: () => { },
    markAttendance: () => { },
    addScheduleItem: () => { },
});

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const storedCourses = await AsyncStorage.getItem('courses');
                if (storedCourses) {
                    setCourses(JSON.parse(storedCourses));
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
            } catch (error) {
                console.error("Failed to save data", error);
            }
        };

        if (!loading) {
            saveData();
        }
    }, [courses, loading]);

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
        isExtraClass: boolean
    ) => {
        setCourses(prevCourses =>
            prevCourses.map((course) => {
                if (course.id === courseId) {

                    // create a new attendance record
                    const newRecord: AttendanceRecord = {
                        id: Date.now().toString(),
                        data: new Date().toISOString(),
                        Status: status,
                        isExtraClass,
                    };

                    const updatedCourse = { ...course };

                    // Find if an attendance record exists for the current day
                    const existingRecordIndex = updatedCourse.attendanceRecords?.findIndex(
                        record => new Date(record.data).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) && record.isExtraClass === isExtraClass
                    ) ?? -1;

                    if (existingRecordIndex > -1 && updatedCourse.attendanceRecords) {
                        // Update the existing record
                        updatedCourse.attendanceRecords[existingRecordIndex] = {
                            ...updatedCourse.attendanceRecords[existingRecordIndex],
                            Status: status,
                        };
                    } else {
                        // create a new attendance record
                        const newRecord: AttendanceRecord = {
                            id: Date.now().toString(),
                            data: new Date().toISOString(),
                            Status: status,
                            isExtraClass,
                        };

                        // add the new record to the attendance records
                        updatedCourse.attendanceRecords = updatedCourse.attendanceRecords ? [
                            ...updatedCourse.attendanceRecords,
                            newRecord,
                        ] : [newRecord];
                    }

                    // Recalculate counters
                    updatedCourse.presents = updatedCourse.attendanceRecords?.filter(r => r.Status === 'present').length || 0;
                    updatedCourse.absents = updatedCourse.attendanceRecords?.filter(r => r.Status === 'absent').length || 0;
                    updatedCourse.cancelled = updatedCourse.attendanceRecords?.filter(r => r.Status === 'cancelled').length || 0;

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

    return (
        <AppContext.Provider
            value={{
                courses,
                loading,
                addCourse,
                updateCourse,
                deleteCourse,
                markAttendance,
                addScheduleItem: addScheduleItem,
            }}
        >
            {children}
        </AppContext.Provider>
    );
}
