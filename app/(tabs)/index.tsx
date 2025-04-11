import React, { useContext, useState, useEffect } from "react";
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  View,
  useColorScheme,
  Platform, // Import Platform
} from "react-native";
import Constants from 'expo-constants'; // Import Constants
import { Colors } from "@/constants/Colors"; // Ensure this path matches your project structure
import { AppContext } from "@/context/AppContext";
import { ClassItem, Course, ScheduleItem, ExtraClass } from "@/types";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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
    // With no classes held, assume you must attend no class.
    return 0;
  }
  const currentFraction = presents / total;
  if (currentFraction >= requiredFraction) {
    // Calculate how many classes can be bunked.
    return -Math.floor(presents / requiredFraction - total);
  } else {
    // Calculate extra classes needed.
    return Math.ceil(
      (requiredFraction * total - presents) / (1 - requiredFraction)
    );
  }
};

// Assign a border color or accent color based on delta.
const getDeltaColor = (delta: number, colorScheme: "light" | "dark") => {
  if (delta > 0) return Colors[colorScheme].error; // Need to attend => red accent
  if (delta < 0) return Colors[colorScheme].success; // Can bunk => green accent
  return Colors[colorScheme].tint; // Exactly at required => tint color
};

export default function TodaysClassesScreen() {
  const { courses, markAttendance, loading } = useContext(AppContext);
  const [todaysClasses, setTodaysClasses] = useState<ClassItem[]>([]);
  const colorScheme: "light" | "dark" = useColorScheme() as "light" | "dark";
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.titleContainer}>
        <ThemedText
          type="title"
          style={{ color: Colors[colorScheme || "light"].text }}
        >
          Today's Classes
        </ThemedText>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/add-extra-class")}
        >
          <Ionicons
            name="add-circle-outline"
            size={28}
            color={Colors[colorScheme || "light"].tint || "#007AFF"}
          />
        </TouchableOpacity>
      </View>
      <TodaysClassesContent
        courses={courses}
        markAttendance={markAttendance}
        loading={loading}
        todaysClasses={todaysClasses}
        setTodaysClasses={setTodaysClasses}
        colorScheme={colorScheme}
      />
    </View>
  );
}

function TodaysClassesContent({
  courses,
  markAttendance,
  loading,
  todaysClasses,
  setTodaysClasses,
  colorScheme,
}: {
  courses: any;
  markAttendance: any;
  loading: any;
  todaysClasses: any;
  setTodaysClasses: any;
  colorScheme: 'light' | 'dark';
}) {
  // Calculate attendance percentage for a course.
  const calculateAttendancePercentage = (course: Course): number => {
    const presents = course.presents || 0;
    const absents = course.absents || 0;
    const totalClasses = presents + absents;
    return totalClasses === 0
      ? 0
      : Math.round((presents / totalClasses) * 100);
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
            requiredAttendance: required,
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
            requiredAttendance: required,
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
    isExtraClass: boolean,
    scheduleItemId?: string
  ) => {
    Alert.alert('Mark Attendance', `Mark this class as ${status}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'OK',
        onPress: () => {
          markAttendance(courseId, status, isExtraClass, scheduleItemId);
        },
      },
    ]);
  };

  const renderClassItem = ({ item }: { item: ClassItem }) => {
    const accentColor = getDeltaColor(item.needToAttend, colorScheme || 'light');
    const cardBackground =
      colorScheme === 'dark' ? '#262626' : '#FFFFFF';
    // We can color-code the text that indicates how many you must attend/bunk
    let attendanceNote = 'At required attendance';
    if (item.needToAttend > 0) {
      attendanceNote = `Need to Attend: ${item.needToAttend} classes`;
    } else if (item.needToAttend < 0) {
      attendanceNote = `Can Bunk: ${Math.abs(item.needToAttend)} classes`;
    }

    return (
      <View
        style={[
          styles.classCardContainer,
          {
            borderLeftColor: accentColor,
            backgroundColor: cardBackground,
          },
        ]}
      >
        <ThemedView style={[styles.classCardContent, {backgroundColor: Colors[colorScheme || 'light'].foreground,}]}>
          <View style={styles.classInfo}>
            <ThemedText type="subtitle" style={styles.courseName}>
              {item.courseName}
            </ThemedText>
            <View style={styles.infoRow}>
              <Ionicons
                name="time-outline"
                size={16}
                color={colorScheme === 'dark' ? '#CCC' : '#888'}
                style={{ marginRight: 4 }}
              />
              <ThemedText>
                {item.timeStart} - {item.timeEnd}{' '}
                {item.isExtraClass ? '(Extra)' : ''}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <Ionicons
                name="stats-chart-outline"
                size={16}
                color={colorScheme === 'dark' ? '#CCC' : '#888'}
                style={{ marginRight: 4 }}
              />
              <ThemedText>
                Current: {item.currentAttendance}% / Req: {item.requiredAttendance}%
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              {attendanceNote === 'At required attendance' && (
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={accentColor}
                  style={{ marginRight: 4 }}
                />
              )}
              {attendanceNote.startsWith('Can Bunk') && (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color={accentColor}
                  style={{ marginRight: 4 }}
                />
              )}
              {attendanceNote.startsWith('Need to Attend') && (
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={accentColor}
                  style={{ marginRight: 4 }}
                />
              )}
              <ThemedText style={{ color: accentColor }}>
                {attendanceNote}
              </ThemedText>
            </View>
          </View>

          <View style={styles.attendanceActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors[colorScheme].success }]}
              onPress={() =>
                handleMarkAttendance(item.courseId, 'present', item.isExtraClass, item.id)
              }
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="white" />
              <ThemedText style={styles.actionButtonText}>Present</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors[colorScheme || 'light'].error }]}
              onPress={() =>
                handleMarkAttendance(item.courseId, 'absent', item.isExtraClass, item.id)
              }
            >
              <Ionicons name="close-circle-outline" size={20} color="white" />
              <ThemedText style={styles.actionButtonText}>Absent</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#9E9E9E' }]}
              onPress={() =>
                handleMarkAttendance(item.courseId, 'cancelled', item.isExtraClass, item.id)
              }
            >
              <Ionicons name="remove-circle-outline" size={20} color="white" />
              <ThemedText style={styles.actionButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </View>
    );
  };

  return (
    <FlatList
      data={todaysClasses}
      renderItem={renderClassItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.classesList}
      ListEmptyComponent={() => (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            No classes scheduled for today!
          </ThemedText>
        </ThemedView>
      )}
      removeClippedSubviews={false}
    />
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    // Use paddingTop instead of marginTop to account for status bar
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight + 16 : 16, 
    backgroundColor: "transparent",
    alignItems: "center",
  },
  addButton: {
    marginLeft: "auto", // Push the button to the right
    padding: 4,
  },
  classesList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  // Outer container for the card, with color-coded accent on the left.
  classCardContainer: {
    borderLeftWidth: 4, // Accent thickness
    borderRadius: 16,  
    marginBottom: 0, // Reduced margin
    // Shadows for iOS:
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    // Elevation for Android:
    elevation: 3,
  },
  // Inner content container so the left accent doesn't overlap text.
  classCardContent: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 0, // Removed marginBottom from here
  },
  classInfo: {
    marginBottom: 16,
  },
  courseName: {
    fontSize: 16,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  attendanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    borderRadius: 6,
    paddingVertical: 8,
    marginHorizontal: 8,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
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
