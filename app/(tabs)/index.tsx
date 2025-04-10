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

export default function TodaysClassesScreen() {
  const { courses, markAttendance, loading } = useContext(AppContext);
  const [todaysClasses, setTodaysClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    if (loading) return; // Don't calculate until courses are loaded

    const today = new Date();
    const currentDayName = DAYS_OF_WEEK[today.getDay()];
    const currentDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const classesForToday: ClassItem[] = [];

    courses.forEach((course: Course) => {
      // Check weekly schedule
      course.weeklySchedule?.forEach((schedule: ScheduleItem) => {
        if (schedule.day === currentDayName) {
          const attendancePercentage = calculateAttendancePercentage(course);
          const totalClasses = (course.presents || 0) + (course.absents || 0);
          const requiredTotal = Math.ceil(((course.presents || 0) + (course.absents || 0)) / (course.requiredAttendance / 100));
          const needToAttend = Math.max(0, requiredTotal - totalClasses);

          classesForToday.push({
            id: `${course.id}-${schedule.id}`,
            courseId: course.id,
            courseName: course.name,
            timeStart: schedule.timeStart,
            timeEnd: schedule.timeEnd,
            isExtraClass: false,
            requiredAttendance: course.requiredAttendance,
            currentAttendance: attendancePercentage,
            needToAttend: needToAttend,
          });
        }
      });

      // Check extra classes
      course.extraClasses?.forEach((extra: ExtraClass) => {
        if (extra.date === currentDateString) {
           const attendancePercentage = calculateAttendancePercentage(course);
           const totalClasses = (course.presents || 0) + (course.absents || 0);
           const requiredTotal = Math.ceil(((course.presents || 0) + (course.absents || 0)) / (course.requiredAttendance / 100));
           const needToAttend = Math.max(0, requiredTotal - totalClasses);

          classesForToday.push({
            id: `${course.id}-extra-${extra.id}`,
            courseId: course.id,
            courseName: course.name,
            timeStart: extra.timeStart,
            timeEnd: extra.timeEnd,
            isExtraClass: true,
            requiredAttendance: course.requiredAttendance,
            currentAttendance: attendancePercentage,
            needToAttend: needToAttend,
          });
        }
      });
    });

    // Sort classes by start time
    classesForToday.sort((a, b) => {
      const timeA = a.timeStart.split(':').map(Number);
      const timeB = b.timeStart.split(':').map(Number);
      if (timeA[0] !== timeB[0]) {
        return timeA[0] - timeB[0];
      }
      return timeA[1] - timeB[1];
    });

    setTodaysClasses(classesForToday);

  }, [courses, loading]);

  const handleMarkAttendance = (courseId: string, status: 'present' | 'absent' | 'cancelled', isExtraClass: boolean) => {
    Alert.alert(
      "Mark Attendance",
      `Mark this class as ${status}?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { text: "OK", onPress: () => markAttendance(courseId, status, isExtraClass) }
      ]
    );
  };

  const calculateAttendancePercentage = (course: Course) => {
    const totalClasses = (course.presents || 0) + (course.absents || 0);
    if (totalClasses === 0) return 0;
    return Math.round(((course.presents || 0) / totalClasses) * 100);
  };

  const renderClassItem = ({ item }: { item: ClassItem }) => (
    <ThemedView style={styles.classCard}>
      <View style={styles.classInfo}>
        <ThemedText type="subtitle">{item.courseName}</ThemedText>
        <ThemedText>Time: {item.timeStart} - {item.timeEnd} {item.isExtraClass ? '(Extra)' : ''}</ThemedText>
        <ThemedText>Current Attendance: {item.currentAttendance}% (Need: {item.requiredAttendance}%)</ThemedText>
        {/* <ThemedText>Need to Attend: {item.needToAttend} more classes</ThemedText> */}
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
      headerImage={
        <Ionicons size={310} name="calendar-outline" style={styles.headerImage} />
      }>
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
          scrollEnabled={false} // Prevent scrolling within the ParallaxScrollView
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
    gap: 12, // Space between info and actions
  },
  classInfo: {
    gap: 4, // Space between text lines
  },
  attendanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8, // Add some space above buttons
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row', // Align icon and text horizontally
    justifyContent: 'center', // Center content
    gap: 6, // Space between icon and text
  },
  presentButton: {
    backgroundColor: '#4CAF50', // Green
  },
  absentButton: {
    backgroundColor: '#F44336', // Red
  },
  cancelledButton: {
    backgroundColor: '#9E9E9E', // Grey
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
