import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, Link } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course, ScheduleItem } from '@/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { courses, loading, deleteCourse } = useContext(AppContext);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!loading && id) {
      const foundCourse = courses.find(c => c.id === id);
      setCourse(foundCourse || null);
    }
  }, [loading, courses, id]);

  const handleDelete = () => {
    if (!course) return;
    Alert.alert(
      "Delete Course",
      `Are you sure you want to delete "${course.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCourse(course.id);
            router.back();
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <ActivityIndicator color={Colors[colorScheme ?? 'light'].tint} />
      </ThemedView>
    );
  }

  if (!course) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <ThemedText style={{ color: Colors[colorScheme ?? 'light'].text }}>Course not found.</ThemedText>
      </ThemedView>
    );
  }

  const calculateAttendancePercentage = (c: Course) => {
    const totalClasses = (c.presents || 0) + (c.absents || 0);
    if (totalClasses === 0) return 0;
    return Math.round((c.presents || 0) / totalClasses * 100);
  };

  const attendancePercentage = calculateAttendancePercentage(course);

  return (
    <>
      <Stack.Screen
        options={{
          title: course.name,
          headerRight: () => (
            <View style={styles.headerButtons}>
              {/* Edit Button - Link to a future edit screen */}
              <Link href={`/edit-course/${course.id}`} asChild>
                <TouchableOpacity>
                  <Ionicons name="create-outline" size={24} color={Colors[colorScheme ?? 'light'].tint} style={styles.headerIcon} />
                </TouchableOpacity>
              </Link>
              {/* Delete Button */}
              <TouchableOpacity onPress={handleDelete}>
                <Ionicons name="trash-outline" size={24} color="red" style={styles.headerIcon} />
              </TouchableOpacity>
            </View>
          ),
          headerStyle: {
            backgroundColor: Colors[colorScheme ?? 'light'].background,
          },
          headerTintColor: Colors[colorScheme ?? 'light'].text,
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <ThemedView style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          <ThemedText type="title" style={{ color: Colors[colorScheme ?? 'light'].text }}>{course.name} ({course.id})</ThemedText>
        </ThemedView>

        <ThemedView style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          <ThemedText type="subtitle" style={{ color: Colors[colorScheme ?? 'light'].text }}>Attendance</ThemedText>
          <ThemedText style={{ color: Colors[colorScheme ?? 'light'].text }}>Required: {course.requiredAttendance}%</ThemedText>
          <ThemedText style={{ color: Colors[colorScheme ?? 'light'].text }}>
            Current: {attendancePercentage}% ({course.presents || 0} Present / {course.absents || 0} Absent / {course.cancelled || 0} Cancelled)
          </ThemedText>
          {/* Add Progress Bar or more detailed stats here if needed */}
        </ThemedView>

        <ThemedView style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          <ThemedText type="subtitle" style={{ color: Colors[colorScheme ?? 'light'].text }}>Weekly Schedule</ThemedText>
          {course.weeklySchedule && course.weeklySchedule.length > 0 ? (
            course.weeklySchedule.map((item: ScheduleItem) => (
              <ThemedText key={item.id} style={[styles.scheduleItem, { color: Colors[colorScheme ?? 'light'].text }]}>
                {item.day}: {item.timeStart} - {item.timeEnd}
              </ThemedText>
            ))
          ) : (
            <ThemedText style={{ color: Colors[colorScheme ?? 'light'].text }}>No weekly schedule set.</ThemedText>
          )}
        </ThemedView>

        {/* Add sections for Extra Classes and Attendance History if needed */}

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 8,
  },
  scheduleItem: {
    marginLeft: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 16,
    marginRight: 10,
  },
  headerIcon: {
    color: '#007AFF',
  },
  deleteIcon: {
    color: 'red',
  },
});
