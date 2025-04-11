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

export default function CoursesScreen() {
  const { courses } = useContext(AppContext);
  const router = useRouter();
  const colorScheme = useColorScheme();

  // Removed unused functions and state

  const calculateAttendancePercentage = (course: Course) => {
    const totalClasses = (course.presents || 0) + (course.absents || 0);
    if (totalClasses === 0) return 0;
    return Math.round((course.presents || 0) / totalClasses * 100);
  };

  const renderCourseItem = ({ item }: { item: Course }) => {
    const attendancePercentage = calculateAttendancePercentage(item);

    return (
      <TouchableOpacity onPress={() => router.push(`/course/${item.id}`)}>
        <ThemedView style={[styles.courseCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          <ThemedView style={styles.courseHeader}>
            <View style={styles.courseInfo}>
              <ThemedText type="subtitle" style={{color: Colors[colorScheme ?? 'light'].text}}>{item.name} ({item.id})</ThemedText>
              <ThemedText style={{color: Colors[colorScheme ?? 'light'].text}}>
                Attendance: {attendancePercentage}%
              </ThemedText>
              <ThemedText style={{color: Colors[colorScheme ?? 'light'].text}}>
                Required: {item.requiredAttendance}%
              </ThemedText>
            </View>
            {/* Right Arrow Icon indicating navigation */}
            <Ionicons name="chevron-forward" size={24} color="#808080" />
          </ThemedView>
          {/* Removed expanded content section */}
        </ThemedView>
      </TouchableOpacity>
    );
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <Ionicons
          size={310}
          name="list-outline"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={{color: Colors[colorScheme ?? 'light'].text}}>My Courses</ThemedText>
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
          scrollEnabled={false}
        />
      ) : (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No courses added yet</ThemedText>
        </ThemedView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080', // Consider theme color
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  courseInfo: {
    flex: 1, // Allow info to take available space
    gap: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  coursesList: {
    gap: 16,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  // Removed duplicate emptyContainer/emptyText styles
  addButton: {
    marginLeft: 'auto', // Push the button to the right
    padding: 4,
  },
});
