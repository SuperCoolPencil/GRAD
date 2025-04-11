import React, { useContext, useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Alert, View } from 'react-native';
import { AppContext } from '@/context/AppContext';
import { ClassItem, Course, ScheduleItem, ExtraClass } from '@/types';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Ionicons from '@expo/vector-icons/Ionicons';

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Helper to calculate attendance delta.
// Returns a positive number when you need to attend extra classes to reach the required attendance,
// a negative number when you can bunk extra classes and still maintain the requirement,
// and zero when you’re exactly meeting the requirement.
const getAttendanceDelta = (
  presents: number,
  absents: number,
  requiredAttendance: number
): number => {
  const total = presents + absents;
  const requiredFraction = requiredAttendance / 100;
  if (total === 0) {
    // With no classes held, assume you must attend at least one class.
    return 1;
  }
  const currentFraction = presents / total;
  if (currentFraction >= requiredFraction) {
    // Calculate how many classes can be bunked.
    return -Math.floor((presents / requiredFraction) - total);
  } else {
    // Calculate extra classes needed.
    return Math.ceil((requiredFraction * total - presents) / (1 - requiredFraction));
  }
};

export default function TodaysClassesScreen() {
  const { courses, markAttendance, loading } = useContext(AppContext);
  const [todaysClasses, setTodaysClasses] = useState<ClassItem[]>([]);

  // Calculate attendance percentage for a course.
  const calculateAttendancePercentage = (course: Course): number => {
    const presents = course.presents || 0;
    const absents = course.absents || 0;
    const totalClasses = presents + absents;
    return totalClasses === 0 ? 0 : Math.round((presents / totalClasses) * 100);
  };

  useEffect(() => {
    if (loading) return; // Wait until courses are loaded

    const today = new Date();
    const currentDayName = DAYS_OF_WEEK[today.getDay()];
    const currentDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const classesForToday: ClassItem[] = [];

    courses.forEach((course: Course) => {
      const presents = course.presents || 0;
      const absents = course.absents || 0;
      const required = course.requiredAttendance || 75;
      const attendancePercentage = calculateAttendancePercentage(course);
      const delta = getAttendanceDelta(presents, absents, required);

      // Process weekly scheduled classes.
      course.weeklySchedule?.forEach((schedule: ScheduleItem) => {
        if (schedule.day === currentDayName) {
          classesForToday.push({
            id: `${course.id}-${schedule.id}`,
            courseId: course.id,
            courseName: course.name,
            timeStart: schedule.timeStart,
            timeEnd: schedule.timeEnd,
            isExtraClass: false,
            requiredAttendance: course.requiredAttendance,
            currentAttendance: attendancePercentage,
            needToAttend: delta,
          });
        }
      });

      // Process extra classes.
      course.extraClasses?.forEach((extra: ExtraClass) => {
        if (extra.date === currentDateString) {
          classesForToday.push({
            id: `${course.id}-extra-${extra.id}`,
            courseId: course.id,
            courseName: course.name,
            timeStart: extra.timeStart,
            timeEnd: extra.timeEnd,
            isExtraClass: true,
            requiredAttendance: course.requiredAttendance,
            currentAttendance: attendancePercentage,
            needToAttend: delta,
          });
        }
      });
    });

    // Sort classes by start time.
    classesForToday.sort((a, b) => {
      const [hourA, minuteA] = a.timeStart.split(':').map(Number);
      const [hourB, minuteB] = b.timeStart.split(':').map(Number);
      return hourA !== hourB ? hourA - hourB : minuteA - minuteB;
    });

    setTodaysClasses(classesForToday);
  }, [courses, loading]);

  const handleMarkAttendance = (
    courseId: string,
    status: 'present' | 'absent' | 'cancelled',
    isExtraClass: boolean
  ) => {
    Alert.alert(
      "Mark Attendance",
      `Mark this class as ${status}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          onPress: () => {
            markAttendance(courseId, status, isExtraClass);
          },
        },
      ]
    );
  };

  const renderClassItem = ({ item }: { item: ClassItem }) => (
    <ThemedView style={styles.classCard}>
      <View style={styles.classInfo}>
        <ThemedText type="subtitle">{item.courseName}</ThemedText>
        <ThemedText>
          Time: {item.timeStart} - {item.timeEnd} {item.isExtraClass ? '(Extra)' : ''}
        </ThemedText>
        <ThemedText>
          Current Attendance: {item.currentAttendance}% (Required: {item.requiredAttendance}%)
        </ThemedText>
        <ThemedText>
          {item.needToAttend > 0
            ? `Need to Attend: ${item.needToAttend} classes`
            : item.needToAttend < 0
            ? `Can Bunk: ${Math.abs(item.needToAttend)} classes`
            : "At required attendance"}
        </ThemedText>
      </View>
      <View style={styles.attendanceActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.presentButton]}
          onPress={() => handleMarkAttendance(item.courseId, 'present', item.isExtraClass)}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="white" />
          <ThemedText style={styles.actionButtonText}>Present</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.absentButton]}
          onPress={() => handleMarkAttendance(item.courseId, 'absent', item.isExtraClass)}
        >
          <Ionicons name="close-circle-outline" size={24} color="white" />
          <ThemedText style={styles.actionButtonText}>Absent</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.cancelledButton]}
          onPress={() => handleMarkAttendance(item.courseId, 'cancelled', item.isExtraClass)}
        >
          <Ionicons name="remove-circle-outline" size={24} color="white" />
          <ThemedText style={styles.actionButtonText}>Cancelled</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={<Ionicons size={310} name="calendar-outline" style={styles.headerImage} />}
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Today's Classes</ThemedText>
      </ThemedView>

      {loading ? (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText>Loading classes...</ThemedText>
        </ThemedView>
      ) : todaysClasses.length > 0 ? (
        <FlatList
          data={todaysClasses}
          renderItem={renderClassItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.classesList}
        />
      ) : (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No classes scheduled for today!</ThemedText>
        </ThemedView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  classesList: {
    gap: 16,
  },
  classCard: {
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  classInfo: {
    gap: 4,
  },
  attendanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  presentButton: {
    backgroundColor: '#4CAF50',
  },
  absentButton: {
    backgroundColor: '#F44336',
  },
  cancelledButton: {
    backgroundColor: '#9E9E9E',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 16,
  },
});
