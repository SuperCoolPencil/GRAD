import { StyleSheet, FlatList, TouchableOpacity, View, Platform, ScrollView } from 'react-native'; // Import Platform, ScrollView
import { useContext } from 'react';
import { Link, useRouter } from 'expo-router';
import Constants from 'expo-constants'; // Import Constants
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AppContext } from '@/context/AppContext';
import { Course } from '@/types';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const truncate = (str: string, n: number) => {
  return (str.length > n) ? str.substring(0, n - 1) + '...' : str;
};

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
  return Colors[colorScheme].tint; // Exactly at required => yellow accent
};


export default function CoursesScreen() {
  const { courses } = useContext(AppContext);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  // Filter out archived courses
  const activeCourses = courses.filter(course => !course.isArchived);

  const renderCourseItem = ({ item }: { item: Course }) => {
    const attendancePercentage = item.attendancePercentage || 0;
    const requiredAttendance = item.requiredAttendance || 75;

    const presentCount = item.presents || 0;
    const absentCount = item.absents || 0;

    const accentColor = getDeltaColor(getAttendanceDelta(presentCount, absentCount, requiredAttendance), colorScheme);

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
                  {truncate(item.name, 20)} ({truncate(item.id, 10)})
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
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      <FlatList
        data={activeCourses}
        showsVerticalScrollIndicator={false}
        renderItem={renderCourseItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.coursesList}
        ListHeaderComponent={
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
        }
        ListEmptyComponent={() => (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              No courses added yet.
            </ThemedText>
          </ThemedView>
        )}
        removeClippedSubviews={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Adjust titleContainer style to match index.tsx and settings.tsx pattern
  titleContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 64,
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
