import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, useColorScheme, Dimensions } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { getWeeklySchedule, getCourses, addAttendanceRecord, updateAttendanceRecord, deleteAttendanceRecord } from '@/utils/database';
import { Course, ScheduleItem, AttendanceRecord } from '@/types';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/Colors';

type AttendanceStatus = 'present' | 'absent';
type ModalAttendanceStatus = AttendanceStatus | 'unmarked';

interface ClassItem {
  course: Course;
  schedule: ScheduleItem;
  attendance?: AttendanceRecord;
}

export default function VisualAttendanceTracker() {
  const colorScheme = useColorScheme() ?? 'light';
  const [startDate, setStartDate] = useState(new Date());
  const [weeklySchedule, setWeeklySchedule] = useState<(ScheduleItem & { course: Course })[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<Record<string, ClassItem[]>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [courseColors, setCourseColors] = useState<Record<string, string>>({});
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(23);

  const generateColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF)
      .toString(16)
      .toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  };

  const fetchCoursesAndSchedule = () => {
    const allCourses = getCourses();
    const schedule = getWeeklySchedule();
    setCourses(allCourses);
    setWeeklySchedule(schedule);

    if (schedule.length > 0) {
      let minHour = 23;
      let maxHour = 0;
      schedule.forEach(item => {
        const start = new Date(`1970-01-01T${item.timeStart}:00`);
        const end = new Date(`1970-01-01T${item.timeEnd}:00`);
        if (start.getHours() < minHour) minHour = start.getHours();
        if (end.getHours() > maxHour) maxHour = end.getHours();
      });
      setStartHour(Math.max(0, minHour - 1));
      setEndHour(Math.min(23, maxHour + 1));
    }

    const newColors: Record<string, string> = {};
    allCourses.forEach(course => {
      if (!course.isArchived) {
        newColors[course.id] = generateColor(course.id);
      }
    });
    setCourseColors(newColors);
  };

  useFocusEffect(
    useCallback(() => {
      fetchCoursesAndSchedule();
    }, [])
  );

  useEffect(() => {
    const newClasses: Record<string, ClassItem[]> = {};
    const date = new Date(startDate);

    for (let i = 0; i < 7; i++) {
      const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' });
      const dateString = date.toISOString().split('T')[0];
      newClasses[dateString] = [];

      weeklySchedule.forEach(item => {
        if (item.day === dayOfWeek) {
          const attendance = courses.find(c => c.id === item.course.id)?.attendanceRecords?.find(
            r => r.date === dateString && r.scheduleItemId === item.id
          );
          newClasses[dateString].push({ course: item.course, schedule: item, attendance });
        }
      });

      courses.forEach(course => {
        course.extraClasses?.forEach(extraClass => {
          if (extraClass.date === dateString) {
            const attendance = course.attendanceRecords?.find(
              r => r.date === dateString && r.isExtraClass
            );
            newClasses[dateString].push({ course, schedule: { ...extraClass, day: dayOfWeek }, attendance });
          }
        });
      });

      newClasses[dateString].sort((a, b) => a.schedule.timeStart.localeCompare(b.schedule.timeStart));
      date.setDate(date.getDate() + 1);
    }
    setClasses(newClasses);
  }, [courses, weeklySchedule, startDate]);

  const handlePrevWeek = () => {
    setStartDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  };

  const handleNextWeek = () => {
    setStartDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  };

  const handleSelectClass = (classItem: ClassItem, date: Date) => {
    setSelectedClass(classItem);
    setSelectedDate(date);
    setModalVisible(true);
  };

  const handleMarkAttendance = (status: ModalAttendanceStatus) => {
    if (!selectedClass) return;

    const { course, schedule, attendance } = selectedClass;
    const dateString = selectedDate.toISOString().split('T')[0];

    if (status === 'unmarked') {
      if (attendance) {
        deleteAttendanceRecord(attendance.id);
      }
    } else {
      if (attendance) {
        // If the status is the same, do nothing
        if (attendance.status === status) {
          setModalVisible(false);
          setSelectedClass(null);
          return;
        }
        updateAttendanceRecord({ ...attendance, status });
      } else {
        const newRecord: AttendanceRecord = {
          id: crypto.randomUUID(),
          course_id: course.id,
          date: dateString,
          status,
          isExtraClass: !!(schedule as any).date,
          scheduleItemId: schedule.id,
        };
        addAttendanceRecord(newRecord);
      }
    }

    fetchCoursesAndSchedule(); // Refetch to update UI
    setModalVisible(false);
    setSelectedClass(null);
  };

  const styles = getStyles(colorScheme, startHour, endHour);
  const getBlockStyle = (classItem: ClassItem) => {
    const status = classItem.attendance?.status || 'unmarked';
    const courseColor = courseColors[classItem.course.id] || Colors[colorScheme].card;

    switch (status) {
      case 'present':
        return [styles.presentBlock, { backgroundColor: courseColor, borderColor: courseColor }];
      case 'absent':
        return [styles.absentBlock, { borderColor: courseColor }];
      default:
        return [styles.unmarkedBlock, { backgroundColor: courseColor, borderColor: courseColor }];
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.dateNavigator}>
        <TouchableOpacity onPress={handlePrevWeek}>
          <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].text} />
        </TouchableOpacity>
        <ThemedText style={styles.dateText}>
          {`${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
        </ThemedText>
        <TouchableOpacity onPress={handleNextWeek}>
          <Ionicons name="chevron-forward" size={24} color={Colors[colorScheme].text} />
        </TouchableOpacity>
      </View>
      <View style={styles.scheduleContainer}>
        <View style={styles.timeAxis}>
          {Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour).map(hour => (
            <View key={hour} style={styles.timeLabel}>
              <View style={styles.verticalTimeContainer}>
                <ThemedText style={styles.timeText}>{`${hour}:00`}</ThemedText>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.schedule}>
          {Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour).map(hour => (
            <View key={hour} style={[styles.gridLine, { top: (hour - startHour) * styles.timeLabel.height }]} />
          ))}
          {Object.keys(classes).map((dateString) => {
            const date = new Date(dateString);
            date.setUTCHours(0,0,0,0);
            return (
            <View key={dateString} style={styles.dayColumn}>
              <ThemedText style={{textAlign: 'center', paddingVertical: 5, fontSize: 12}}>{date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</ThemedText>
              {classes[dateString].map((classItem, index) => {
                const start = new Date(`1970-01-01T${classItem.schedule.timeStart}:00`);
                const end = new Date(`1970-01-01T${classItem.schedule.timeEnd}:00`);
                if (start.getHours() < startHour || end.getHours() > endHour) return null;

                const duration = (end.getTime() - start.getTime()) / (1000 * 60);
                const top = (start.getHours() - startHour + start.getMinutes() / 60) * (styles.timeLabel.height);
                const height = (duration / 60) * (styles.timeLabel.height);

                return (
                  <TouchableOpacity
                    key={`${classItem.course.id}-${index}`}
                    style={[
                      styles.classBlock,
                      getBlockStyle(classItem),
                      { top: top + 35, height },
                    ]}
                    onPress={() => handleSelectClass(classItem, date)}
                  >
                    <View style={styles.verticalTextContainer}>
                      <ThemedText style={styles.courseCode} numberOfLines={1}>{classItem.course.name}</ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )})}
        </View>
      </View>
      <Modal
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => handleMarkAttendance('present')}
            >
              <ThemedText>Mark Present</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => handleMarkAttendance('absent')}
            >
              <ThemedText>Mark Absent</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => handleMarkAttendance('unmarked')}
            >
              <ThemedText>Clear Status</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const scheduleHeight = screenHeight - 150; // Adjust 150 for header and other UI elements
const dayColumnWidth = (screenWidth - 60) / 7;

const getStyles = (colorScheme: 'light' | 'dark', startHour: number, endHour: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors[colorScheme].background,
  },
  dateNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors[colorScheme].text,
  },
  scheduleContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  timeAxis: {
    width: 30,
    alignItems: 'center',
  },
  verticalTimeContainer: {
    transform: [{ rotate: '-90deg' }],
    width: 50,
  },
  timeText: {
    fontSize: 10,
    textAlign: 'center',
  },
  timeLabel: {
    height: (scheduleHeight - 40) / (endHour - startHour + 1),
    justifyContent: 'center',
  },
  schedule: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  dayColumn: {
    width: dayColumnWidth,
    borderLeftWidth: 1,
    borderLeftColor: Colors[colorScheme].border,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors[colorScheme].border,
  },
  classBlock: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  verticalTextContainer: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  presentBlock: {
    opacity: 1,
  },
  absentBlock: {
    backgroundColor: Colors[colorScheme].background,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  unmarkedBlock: {
    opacity: 0.5,
  },
  courseCode: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors[colorScheme].text,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors[colorScheme].card,
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalButton: {
    padding: 15,
    alignItems: 'center',
  },
});
