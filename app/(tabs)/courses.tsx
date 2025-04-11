import { StyleSheet, FlatList, TouchableOpacity, View } from 'react-native';
import { useContext } from 'react';
import { Link, useRouter } from 'expo-router';
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
    <View style={{ flex: 1 }}>
      <TopBar />
      <CoursesContent
        courses={courses}
        colorScheme={colorScheme}
        router={router}
      />
    </View>
  );
}

function CoursesContent({ courses, colorScheme, router }: { courses: any; colorScheme: 'light' | 'dark'; router: any }) {
  // Calculate attendance percentage for each course.
  const calculateAttendancePercentage = (course: Course) => {
    const totalClasses =
      (course.presents || 0) + (course.absents || 0);
    if (totalClasses === 0) return 100;
    return Math.round(((course.presents || 0) / totalClasses) * 100);
  };

  const renderCourseItem = ({ item }: { item: Course }) => {
    const attendancePercentage = calculateAttendancePercentage(item);

    // Determine the accent color based on attendance percentage
    const getAccentColor = () => {
      if (attendancePercentage >= item.requiredAttendance) return '#4CAF50'; // Green for good attendance
      if (attendancePercentage >= item.requiredAttendance - 10) return '#FFC107'; // Yellow for borderline
      return '#F44336'; // Red for poor attendance
    };

    const accentColor = getAccentColor();

    return (
      <TouchableOpacity onPress={() => router.push(`/course/${item.id}`)}>
        <View style={[styles.courseCardContainer, { borderLeftColor: accentColor }]}>
          <ThemedView
            style={[
              styles.courseCard,
              { backgroundColor: Colors[colorScheme ?? 'light'].background },
            ]}
          >
            <ThemedView style={styles.courseHeader}>
              <View style={styles.courseInfo}>
                <ThemedText
                  type="subtitle"
                  style={{ color: Colors[colorScheme ? colorScheme : 'light'].text }}
                >
                  {item.name} ({item.id})
                </ThemedText>
                <ThemedText style={{ color: Colors[colorScheme ? colorScheme : 'light'].text }}>
                  Attendance: {attendancePercentage}%
                </ThemedText>
                <ThemedText style={{ color: Colors[colorScheme ? colorScheme : 'light'].text }}>
                  Required: {item.requiredAttendance}%
                </ThemedText>
              </View>
              {/* Right Arrow Icon indicating navigation */}
              <Ionicons
                name="chevron-forward"
                size={24}
                color={Colors[colorScheme ? colorScheme : 'light'].icon || '#808080'}
              />
            </ThemedView>
          </ThemedView>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View>
      <ThemedView style={[styles.titleContainer, { marginTop: 0 }]}>
        <ThemedText
          type="title"
          style={{ color: Colors[colorScheme || 'light'].text }}
        >
          My Courses
        </ThemedText>
        <Link href="/add-course" asChild>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add-circle-outline" size={28} color="#007AFF" />
          </TouchableOpacity>
        </Link>
      </ThemedView>

      {courses.length > 0 ? (
        <FlatList
          data={courses}
          renderItem={renderCourseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.coursesList}
        />
      ) : (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            No courses added yet
          </ThemedText>
        </ThemedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  coursesList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  courseCardContainer: {
    borderLeftWidth: 4, // Accent thickness
    borderRadius: 8,
    marginBottom: 16,
    // Shadows for iOS:
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    // Elevation for Android:
    elevation: 3,
  },
  courseCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 16,
  },
});
