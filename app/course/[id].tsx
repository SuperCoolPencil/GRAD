import React, { useContext, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  useColorScheme as useNativeColorScheme, // Rename to avoid conflict
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter, Link } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course, ScheduleItem, ExtraClass } from '@/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
// Assuming useColorScheme hook provides 'light' | 'dark'
// If your hook is different, adjust accordingly.
// import { useColorScheme } from '@/hooks/useColorScheme';

// --- Helper functions copied/adapted from index.tsx ---

// Helper to calculate attendance delta.
const getAttendanceDelta = (
  presents: number,
  absents: number,
  requiredAttendance: number
): number => {
  const total = presents + absents;
  const requiredFraction = requiredAttendance / 100;
  if (total === 0) {
    return 0; // No classes held yet
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
const getDeltaColor = (delta: number, colorScheme: 'light' | 'dark') => {
  if (delta > 0) return Colors[colorScheme].error; // Need to attend => red accent
  if (delta < 0) return Colors[colorScheme].success; // Can bunk => green accent
  return Colors[colorScheme].tint; // Exactly at required => yellow/default tint accent
};

// --- Component Start ---

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { courses, loading, deleteCourse } = useContext(AppContext);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  // Use the hook correctly
  const colorScheme = useNativeColorScheme() ?? 'light'; // Default to light if null

  useEffect(() => {
    if (!loading && id) {
      // Ensure case-insensitive comparison if IDs might differ in case
      const foundCourse = courses.find((c) => c.id.toLowerCase() === id.toLowerCase());
      setCourse(foundCourse || null);
    }
  }, [loading, courses, id]);

  const handleDelete = () => {
    if (!course) return;
    Alert.alert(
      'Delete Course',
      `Are you sure you want to delete "${course.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCourse(course.id);
            router.back(); // Go back after deletion
          },
        },
      ]
    );
  };

  // --- Loading and Not Found States ---
  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </ThemedView>
    );
  }

  if (!course) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <ThemedText type="subtitle">Course Not Found</ThemedText>
        <ThemedText>The course with ID '{id}' could not be found.</ThemedText>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: Colors[colorScheme].tint }}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // --- Calculations ---
  const presents = course.presents || 0;
  const absents = course.absents || 0;
  const cancelled = course.cancelled || 0;
  const totalAttended = presents + absents;
  const attendancePercentage = totalAttended === 0 ? 0 : Math.round((presents / totalAttended) * 100);
  const requiredAttendance = course.requiredAttendance || 75; // Default if not set
  const delta = getAttendanceDelta(presents, absents, requiredAttendance);
  const deltaColor = getDeltaColor(delta, colorScheme);

  let attendanceNote = 'Meeting required attendance';
  if (delta > 0) {
    attendanceNote = `Need to Attend: ${delta} more class${delta === 1 ? '' : 'es'}`;
  } else if (delta < 0) {
    attendanceNote = `Can Bunk: ${Math.abs(delta)} class${Math.abs(delta) === 1 ? '' : 'es'}`;
  }

  // --- Render ---
  return (
    <>
      <Stack.Screen
        options={{
          title: course.name, // Use course name for the title
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Link href={`/edit-course/${course.id}`} asChild>
                <TouchableOpacity>
                  <Ionicons
                    name="pencil"
                    size={24}
                    color={Colors[colorScheme].tint}
                    style={styles.headerIcon}
                  />
                </TouchableOpacity>
              </Link>
              <TouchableOpacity onPress={handleDelete}>
                <Ionicons
                  name="trash-outline" // Use trash icon for delete
                  size={24}
                  color={Colors[colorScheme].error} // Use error color for delete
                  style={styles.headerIcon}
                />
              </TouchableOpacity>
            </View>
          ),
          headerStyle: {
            backgroundColor: Colors[colorScheme].background,
          },
          headerTintColor: Colors[colorScheme].text,
          headerTitleStyle: {
             // fontWeight: 'bold', // Optional: make title bold
          },
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
        contentContainerStyle={styles.contentContainer}
      >
        {/* --- Attendance Card --- */}
        <ThemedView style={[styles.card, { borderLeftColor: deltaColor, backgroundColor: Colors[colorScheme].card }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            Attendance Summary
          </ThemedText>

          <View style={styles.attendanceRow}>
            <Ionicons name="pie-chart-outline" size={20} color={Colors[colorScheme].text} />
            <ThemedText style={styles.attendanceText}>
              Current: <ThemedText type="defaultSemiBold">{attendancePercentage}%</ThemedText> (Required: {requiredAttendance}%)
            </ThemedText>
          </View>

          <View style={styles.attendanceRow}>
            <Ionicons
              name={delta <= 0 ? "checkmark-circle-outline" : "alert-circle-outline"}
              size={20}
              color={deltaColor}
            />
            <ThemedText style={[styles.attendanceText, { color: deltaColor }]}>
              {attendanceNote}
            </ThemedText>
          </View>

          <View style={styles.attendanceDetailRow}>
            <View style={styles.attendanceDetailItem}>
              <Ionicons name="checkmark-outline" size={18} color={Colors[colorScheme].success} />
              <ThemedText style={styles.detailText}> Present: {presents}</ThemedText>
            </View>
            <View style={styles.attendanceDetailItem}>
              <Ionicons name="close-outline" size={18} color={Colors[colorScheme].error} />
              <ThemedText style={styles.detailText}> Absent: {absents}</ThemedText>
            </View>
            <View style={styles.attendanceDetailItem}>
              <Ionicons name="remove-circle-outline" size={18} color={Colors[colorScheme].icon} />
              <ThemedText style={styles.detailText}> Cancelled: {cancelled}</ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* --- Weekly Schedule Card --- */}
        {(course.weeklySchedule && course.weeklySchedule.length > 0) && (
          <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              Weekly Schedule
            </ThemedText>
            {course.weeklySchedule.map((item: ScheduleItem) => (
              <View key={item.id} style={styles.scheduleItem}>
                <Ionicons name="calendar-outline" size={18} color={Colors[colorScheme].icon} />
                <ThemedText style={styles.scheduleText}>
                  <ThemedText type="defaultSemiBold">{item.day}:</ThemedText> {item.timeStart} - {item.timeEnd}
                </ThemedText>
              </View>
            ))}
          </ThemedView>
        )}

        {/* --- Extra Classes Card --- */}
        {(course.extraClasses && course.extraClasses.length > 0) && (
          <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              Extra Classes
            </ThemedText>
            {course.extraClasses.map((item: ExtraClass) => (
              <View key={item.id} style={styles.scheduleItem}>
                <Ionicons name="add-circle-outline" size={18} color={Colors[colorScheme].tint} />
                <ThemedText style={styles.scheduleText}>
                  <ThemedText type="defaultSemiBold">{item.date}:</ThemedText> {item.timeStart} - {item.timeEnd}
                </ThemedText>
              </View>
            ))}
          </ThemedView>
        )}

        {/* Optional: Add a spacer at the bottom */}
         <View style={{ height: 20 }} />

      </ScrollView>
    </>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 16, // Match index.tsx
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 5, // Accent border
    borderColor: 'transparent', // Default to transparent, override for attendance
    // Shadow/Elevation (consider adjusting based on theme)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    marginBottom: 12,
    fontSize: 18, // Slightly larger title
  },
  headerButtons: {
    flexDirection: 'row',
    marginRight: 10, // Adjust spacing as needed
  },
  headerIcon: {
    marginLeft: 16, // Space between icons
  },
  backButton: {
    marginTop: 20,
    padding: 10,
  },
  // Attendance Card Specific Styles
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  attendanceText: {
    marginLeft: 8,
    fontSize: 16,
  },
  attendanceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    // Use a subtle border color based on theme
    // borderTopColor: Colors[colorScheme].border, // Assuming border color exists in Colors
     borderTopColor: 'rgba(128, 128, 128, 0.2)', // Fallback gray border
  },
  attendanceDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 4,
    fontSize: 14,
  },
  // Schedule Card Specific Styles
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  scheduleText: {
    marginLeft: 8,
    fontSize: 15,
  },
});
