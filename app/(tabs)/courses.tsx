import { StyleSheet, FlatList, TouchableOpacity, View, Platform } from 'react-native'; // Import Platform
import { useContext } from 'react';
import { Link, useRouter } from 'expo-router';
import Constants from 'expo-constants'; // Import Constants
import Ionicons from '@expo/vector-icons/Ionicons';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AppContext } from '@/context/AppContext';
import { Course } from '@/types';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import TopBar from '@/components/TopBar';

export default function CoursesScreen() {
  const { courses } = useContext(AppContext);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  return (
    // Add background color to the main container, consistent with settings.tsx
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      {/* Move Title Container Here */}
      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="title"
          numberOfLines={1}
          style={[{ color: Colors[colorScheme].text }]}
        >
          My Courses
        </ThemedText>
        <Link href="/add-course" asChild>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons
              name="add-circle-outline"
              size={28}
              color={Colors[colorScheme].tint}
            />
          </TouchableOpacity>
        </Link>
      </ThemedView>
      {/* Pass props to Content */}
      <CoursesContent
        courses={courses}
        colorScheme={colorScheme}
        router={router}
      />
    </View>
  );
}

function CoursesContent({ courses, colorScheme, router }: { courses: any; colorScheme: 'light' | 'dark'; router: any }) {

  const renderCourseItem = ({ item }: { item: Course }) => {
    const attendancePercentage = item.attendancePercentage || 0;

    // Determine the accent color based on attendance percentage - theme aware
    const getAccentColor = () => {
      if (attendancePercentage >= item.requiredAttendance)
        return Colors[colorScheme].success; // Green for good attendance
      if (attendancePercentage >= item.requiredAttendance - 10)
        return Colors[colorScheme].warning; // Yellow for borderline
      return Colors[colorScheme].error; // Red for poor attendance
    };

    const accentColor = getAccentColor();

    // Calculate the counts for present, absent, and cancelled classes for each course
    let presentCount = 0;
    let absentCount = 0;
    let cancelledCount = 0;

    if (item.classes) {
      item.classes.forEach((cls: any) => {
        if (cls.status === 'present') {
          presentCount++;
        } else if (cls.status === 'absent') {
          absentCount++;
        } else if (cls.status === 'cancelled') {
          cancelledCount++;
        }
      });
    }

    return (
      <TouchableOpacity onPress={() => router.push(`/course/${item.id}`)}>
        <View style={[styles.courseCardContainer, {
          borderLeftColor: accentColor,
          shadowColor: Colors[colorScheme].shadow,
          backgroundColor: Colors[colorScheme].card,
        }]}>
          <ThemedView
            style={[
              styles.courseCard,
              {
                backgroundColor: Colors[colorScheme].card,
              },
            ]}
          >
            <ThemedView style={styles.courseHeader}>
              <View style={styles.courseInfo}>
                <ThemedText
                  type="subtitle"
                  style={{ color: Colors[colorScheme].text }}
                >
                  {item.name} ({item.id})
                </ThemedText>
                <ThemedText style={{ color: Colors[colorScheme].text }}>
                  Attendance: {attendancePercentage}%
                </ThemedText>
                <ThemedText style={{ color: Colors[colorScheme].text }}>
                  Required: {item.requiredAttendance}%
                </ThemedText>
              </View>
              {/* Right Arrow Icon indicating navigation */}
              <Ionicons
                name="chevron-forward"
                size={24}
                color={Colors[colorScheme].icon}
              />
            </ThemedView>
          </ThemedView>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={courses}
      renderItem={renderCourseItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.coursesList}
      ListEmptyComponent={() => (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            No courses added yet.
          </ThemedText>
        </ThemedView>
      )}
      removeClippedSubviews={false}
    />
  );
}

const styles = StyleSheet.create({
  // Adjust titleContainer style to match index.tsx and settings.tsx pattern
  titleContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    // Use paddingTop instead of marginTop to account for status bar
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight + 64 : 32, 
    backgroundColor: "transparent",
    alignItems: "center",
  },
  coursesList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  courseCardContainer: {
    borderLeftWidth: 4, // Accent thickness
    borderRadius: 16,
    marginBottom: 0, // Reduced margin
    // Shadows for iOS:
  },
  courseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 0, // Removed marginBottom from here
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  courseInfo: {
    flex: 1,
    gap: 4,
  },
  addButton: {
    marginLeft: 'auto', // Push the button to the right
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 16,
  },
});
