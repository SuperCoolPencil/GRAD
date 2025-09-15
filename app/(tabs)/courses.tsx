import { StyleSheet, FlatList, TouchableOpacity, View, Platform, ScrollView } from 'react-native'; // Import Platform, ScrollView
import { useContext, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import Constants from 'expo-constants'; // Import Constants
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AttendanceProgressRing from '@/components/AttendanceProgressRing';
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

  const [sortBy, setSortBy] = useState<'attendance' | 'alphabetical'>('attendance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filter out archived courses
  let activeCourses = courses.filter(course => !course.isArchived);

  // Apply sorting
  const sortedCourses = [...activeCourses].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    } else if (sortBy === 'attendance') {
        const deltaA = getAttendanceDelta(a.presents || 0, a.absents || 0, a.requiredAttendance || 75);
        const deltaB = getAttendanceDelta(b.presents || 0, b.absents || 0, b.requiredAttendance || 75);

        if (deltaA !== deltaB) {
          return sortOrder === 'asc' ? deltaB - deltaA : deltaA - deltaB;
        }

        // If delta is the same, sort by attendance percentage
        const percentageA = a.attendancePercentage || 0;
        const percentageB = b.attendancePercentage || 0;

        if (sortOrder === 'asc') {
          // For ascending, lower percentage is "worse" so it comes first
          return percentageA - percentageB;
        } else {
          // For descending, higher percentage is "better" so it comes first
          return percentageB - percentageA;
        }
      }
    
    return 0;
  });

  const renderCourseItem = ({ item }: { item: Course }) => {
    const attendancePercentage = item.attendancePercentage || 0;
    const requiredAttendance = item.requiredAttendance || 75;

    const presentCount = item.presents || 0;
    const absentCount = item.absents || 0;
    const delta = getAttendanceDelta(presentCount, absentCount, requiredAttendance);
    const deltaColor = getDeltaColor(delta, colorScheme);

    // Calculate progress for the ring
    const totalClasses = presentCount + absentCount;
    let progress = 0;
    if (totalClasses > 0) {
      progress = attendancePercentage / 100;
    }

    return (
      <TouchableOpacity onPress={() => router.push(`/course/${item.id}`)}>
        <View style={[styles.courseCardContainer, {
          borderLeftColor: deltaColor,
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ThemedText
                    type="subtitle"
                    style={{ color: Colors[colorScheme].text }}
                  >
                    {truncate(item.name, 20)}
                  </ThemedText>
                  {/* <ThemedText style={{
                    fontSize: 12,
                    color: Colors[colorScheme].background,
                    fontWeight: 'bold',
                    backgroundColor: Colors[colorScheme].textSecondary,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 8,
                    marginLeft: 8, // Add some space between name and tag
                    overflow: 'hidden', // Ensure content is clipped to the border radius
                  }}>
                    {truncate(item.id, 10)}
                  </ThemedText> */}
                </View>
                <View style={styles.attendanceRow}>
                  <ThemedText style={{ fontSize: 12, color: Colors[colorScheme].textSecondary }}>Attendance:</ThemedText>
                  <ThemedText style={{ color: Colors[colorScheme].text }}>
                    {attendancePercentage}%
                  </ThemedText>
                </View>
                <View style={styles.attendanceRow}>
                  <ThemedText style={{ fontSize: 12, color: Colors[colorScheme].textSecondary }}>Required:</ThemedText>
                  <ThemedText style={{ color: Colors[colorScheme].text }}>
                    {item.requiredAttendance}%
                  </ThemedText>
                </View>
              </View>
              <View style={styles.deltaContainer}>
                <AttendanceProgressRing
                  progress={progress}
                  color={deltaColor}
                  size={50}
                  strokeWidth={5}
                  delta={delta}
                />
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
        data={sortedCourses}
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
            <View style={styles.sortContainer}>
              <TouchableOpacity
                onPress={() => setSortBy(sortBy === 'alphabetical' ? 'attendance' : 'alphabetical')}
                style={[
                  styles.sortButton,
                  { backgroundColor: Colors[colorScheme].tint },
                ]}
              >
                <Ionicons
                  name={sortBy === 'alphabetical' ? 'text' : 'stats-chart'}
                  size={20}
                  color={Colors[colorScheme].background}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={[
                  styles.sortButton,
                  { backgroundColor: Colors[colorScheme].tint },
                ]}
              >
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={20}
                  color={Colors[colorScheme].background}
                />
              </TouchableOpacity>
            </View>
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
    //borderLeftWidth: 4, // Accent thickness
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
    flex: 1,
  },
  courseInfo: {
    flex: 1,
    gap: 4,
  },
  deltaContainer: {
    marginLeft: 8, // Shift more left, closer to course info
    marginRight: 8, // Add some margin to the right of the circle
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    marginLeft: 'auto', // Push the button to the right
    padding: 4,
  },
  sortContainer: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  sortButton: {
    padding: 8,
    borderRadius: 8,
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
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
