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
              color={Colors[colorScheme].tint || '#007AFF'}
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
  // Calculate attendance percentage for each course.
  const calculateAttendancePercentage = (course: Course) => {
    const totalClasses =
      (course.presents || 0) + (course.absents || 0);
    if (totalClasses === 0) return 100;
    return Math.round(((course.presents || 0) / totalClasses) * 100);
  };

  const renderCourseItem = ({ item }: { item: Course }) => {
    const attendancePercentage = calculateAttendancePercentage(item);

    // Determine the accent color based on attendance percentage - theme aware
    const getAccentColor = () => {
      if (attendancePercentage >= item.requiredAttendance) 
        return Colors[colorScheme || 'light'].success || '#4CAF50'; // Green for good attendance
      if (attendancePercentage >= item.requiredAttendance - 10) 
        return Colors[colorScheme || 'light'].warning || '#FFC107'; // Yellow for borderline
      return Colors[colorScheme || 'light'].error || '#F44336'; // Red for poor attendance
    };

    const accentColor = getAccentColor();

    return (
      <TouchableOpacity onPress={() => router.push(`/course/${item.id}`)}>
        <View style={[styles.courseCardContainer, { 
          borderLeftColor: accentColor,
          shadowColor: Colors[colorScheme || 'light'].shadow || '#000',
        }]}>
          <ThemedView
            style={[
              styles.courseCard,
              { 
                backgroundColor: Colors[colorScheme || 'light'].foreground, },
            ]}
          >
            <ThemedView style={styles.courseHeader}>
              <View style={styles.courseInfo}>
                <ThemedText
                  type="subtitle"
                  style={{ color: Colors[colorScheme || 'light'].text}}
                >
                  {item.name} ({item.id})
                </ThemedText>
                <ThemedText style={{ color: Colors[colorScheme || 'light'].text }}>
                  Attendance: {attendancePercentage}%
                </ThemedText>
                <ThemedText style={{ color: Colors[colorScheme || 'light'].text }}>
                  Required: {item.requiredAttendance}%
                </ThemedText>
              </View>
              {/* Right Arrow Icon indicating navigation */}
              <Ionicons
                name="chevron-forward"
                size={24}
                color={Colors[colorScheme || 'light'].icon || '#808080'}
              />
            </ThemedView>
          </ThemedView>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    // Simplify the outer View in Content, main View and FlatList handle layout/padding
    <View style={{ flex: 1 }}>
      {/* Title Container Removed From Here */}

      {courses.length > 0 ? (
        <FlatList
          data={courses}
          renderItem={renderCourseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.coursesList}
        />
      ) : (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={[styles.emptyText, {
            color: Colors[colorScheme || 'light'].text
          }]}>
            No courses added yet
          </ThemedText>
        </ThemedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Adjust titleContainer style to match index.tsx and settings.tsx pattern
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Ensure button stays right
    gap: 8,
    paddingHorizontal: 16,
    // Use paddingTop instead of marginTop to account for status bar
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight + 16 : 16, 
    paddingBottom: 8, // Consistent bottom padding
    backgroundColor: 'transparent', // Keep transparent
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    // Elevation for Android:
    elevation: 3,
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
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 16,
  },
});
