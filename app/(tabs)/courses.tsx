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
import { calculateTargetDate } from '@/utils/attendance';

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
  const { courses, holidays, skipDays } = useContext(AppContext);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const [sortBy, setSortBy] = useState<'attendance' | 'alphabetical' | 'targetDate'>('attendance');
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
    } else if (sortBy === 'targetDate') {
      // Sort by target date
      // Ascending: courses needing most attention first (earlier target dates, fewer bunk days)
      // Descending: courses doing well first (more bunk days, later target dates)
      const targetA = calculateTargetDate(a, holidays, skipDays);
      const targetB = calculateTargetDate(b, holidays, skipDays);
      const deltaA = getAttendanceDelta(a.presents || 0, a.absents || 0, a.requiredAttendance || 75);
      const deltaB = getAttendanceDelta(b.presents || 0, b.absents || 0, b.requiredAttendance || 75);

      // Check if courses are meeting target (delta <= 0 means can bunk)
      const aMeetsTarget = deltaA <= 0;
      const bMeetsTarget = deltaB <= 0;

      // If both meeting target, sort by bunk days available (more bunk days = better, so first in asc)
      if (aMeetsTarget && bMeetsTarget) {
        // deltaA is negative (can bunk that many), so more negative = more bunk days = comes first in asc
        const bunkCompare = deltaA - deltaB;
        return sortOrder === 'asc' ? bunkCompare : -bunkCompare;
      }

      // Courses meeting target come FIRST in ascending (already achieved = minimum target date)
      if (aMeetsTarget && !bMeetsTarget) return sortOrder === 'asc' ? -1 : 1;
      if (!aMeetsTarget && bMeetsTarget) return sortOrder === 'asc' ? 1 : -1;

      // Both need to attend - sort by target date or classes needed
      if (targetA.targetDate && targetB.targetDate) {
        const dateCompare = targetA.targetDate.getTime() - targetB.targetDate.getTime();
        return sortOrder === 'asc' ? dateCompare : -dateCompare;
      }

      // If only one has a target date, the one with a date comes first in asc
      if (targetA.targetDate && !targetB.targetDate) return sortOrder === 'asc' ? -1 : 1;
      if (!targetA.targetDate && targetB.targetDate) return sortOrder === 'asc' ? 1 : -1;

      // If neither has a target date, sort by classes needed (delta)
      return sortOrder === 'asc' ? deltaB - deltaA : deltaA - deltaB;
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
                <View style={styles.attendanceRow}>
                  <ThemedText style={{ fontSize: 12, color: Colors[colorScheme].textSecondary }}>Target:</ThemedText>
                  {(() => {
                    const target = calculateTargetDate(item, holidays, skipDays);
                    const isMet = target.classesNeeded === 0;
                    return (
                      <ThemedText style={{ color: isMet ? Colors[colorScheme].success : deltaColor }}>
                        {isMet ? '✓ Met' : (
                          target.targetDate
                            ? target.targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : `${target.classesNeeded} classes`
                        )}
                      </ThemedText>
                    );
                  })()}
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
            onPress={() => {
              if (sortBy === 'attendance') setSortBy('alphabetical');
              else if (sortBy === 'alphabetical') setSortBy('targetDate');
              else setSortBy('attendance');
            }}
            style={[
              styles.sortButton,
              { backgroundColor: Colors[colorScheme].tint },
            ]}
          >
            <Ionicons
              name={sortBy === 'alphabetical' ? 'text' : sortBy === 'targetDate' ? 'calendar' : 'stats-chart'}
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
      <FlatList
        data={sortedCourses}
        showsVerticalScrollIndicator={false}
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Adjust titleContainer style to match index.tsx and settings.tsx pattern
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 64,
    backgroundColor: "transparent",
  },
  coursesList: {
    gap: 8, // Increased gap for breathing room
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  courseCardContainer: {
    borderRadius: 20, // Softer corners
    marginBottom: 0,
  },
  courseCard: {
    borderRadius: 20,
    padding: 18, // Slightly more padding
    marginBottom: 0,
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
    borderRadius: 10, // Softer button corners
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
