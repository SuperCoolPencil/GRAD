import { StyleSheet, FlatList, TouchableOpacity, View } from 'react-native';
import { useContext, useEffect, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AppContext } from '@/context/AppContext';
import { Course } from '@/types';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { calculateTargetDate, getCourseAttendanceDelta } from '@/utils/attendance';

const truncate = (value: string, length: number) => value.length > length ? `${value.slice(0, length - 1)}...` : value;

// Assign a border color or accent color based on delta.
const getDeltaColor = (delta: number, colorScheme: "light" | "dark") => {
  if (delta > 0) return Colors[colorScheme].error; // Need to attend => red accent
  if (delta < 0) return Colors[colorScheme].success; // Can bunk => green accent
  return Colors[colorScheme].success; // On target is a success state too
};

type CourseSort = 'attendance' | 'alphabetical' | 'targetDate';
type SortOrder = 'asc' | 'desc';

const isCourseSort = (value: unknown): value is CourseSort =>
  value === 'attendance' || value === 'alphabetical' || value === 'targetDate';

const isSortOrder = (value: unknown): value is SortOrder => value === 'asc' || value === 'desc';


export default function CoursesScreen() {
  const { courses, holidays, skipDays, settings, updateSetting } = useContext(AppContext);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const [sortBy, setSortBy] = useState<CourseSort>('attendance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    if (isCourseSort(settings.coursesSortBy)) setSortBy(settings.coursesSortBy);
    if (isSortOrder(settings.coursesSortOrder)) setSortOrder(settings.coursesSortOrder);
  }, [settings.coursesSortBy, settings.coursesSortOrder]);

  const changeSortBy = () => {
    const nextSortBy: CourseSort = sortBy === 'attendance'
      ? 'alphabetical'
      : sortBy === 'alphabetical'
        ? 'targetDate'
        : 'attendance';
    setSortBy(nextSortBy);
    updateSetting('coursesSortBy', nextSortBy);
  };

  const toggleSortOrder = () => {
    const nextSortOrder: SortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(nextSortOrder);
    updateSetting('coursesSortOrder', nextSortOrder);
  };

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
      const deltaA = getCourseAttendanceDelta(a, holidays, skipDays);
      const deltaB = getCourseAttendanceDelta(b, holidays, skipDays);

      if (deltaA !== deltaB) {
        return sortOrder === 'asc' ? deltaB - deltaA : deltaA - deltaB;
      }

      // If delta is the same, sort by attendance percentage
      const percentageA = a.attendancePercentage ?? 0;
      const percentageB = b.attendancePercentage ?? 0;

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
      const deltaA = getCourseAttendanceDelta(a, holidays, skipDays);
      const deltaB = getCourseAttendanceDelta(b, holidays, skipDays);

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
      if (!Number.isFinite(deltaA) || !Number.isFinite(deltaB)) {
        if (deltaA === deltaB) return 0;
        const comparison = !Number.isFinite(deltaA) ? 1 : -1;
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      return sortOrder === 'asc' ? deltaB - deltaA : deltaA - deltaB;
    }

    return 0;
  });

  const renderCourseItem = ({ item }: { item: Course }) => {
    const attendancePercentage = item.attendancePercentage ?? 0;
    const delta = getCourseAttendanceDelta(item, holidays, skipDays);
    const deltaColor = getDeltaColor(delta, colorScheme);
    const attendanceGuidance = !Number.isFinite(delta)
      ? 'Target is no longer reachable'
      : delta > 0
        ? `Need to attend ${delta} class${delta === 1 ? '' : 'es'}`
        : delta < 0
          ? `Can bunk ${Math.abs(delta)} class${Math.abs(delta) === 1 ? '' : 'es'}`
          : 'On track';
    const target = calculateTargetDate(item, holidays, skipDays);
    const isTargetMet = target.classesNeeded === 0;

    return (
      <TouchableOpacity onPress={() => router.push(`/course/${item.id}`)}>
        <View style={[styles.courseCardContainer, {
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
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <ThemedText
                    type="itemTitle"
                    style={{ color: Colors[colorScheme].text }}
                  >
                    {truncate(item.name, 20)}
                  </ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons
                    name={delta > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                    size={16}
                    color={Colors[colorScheme].icon}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText numberOfLines={1} style={[styles.courseStatusText, { color: Colors[colorScheme].textSecondary }]}>
                    {Number.isFinite(delta) ? delta !== 0 ? (
                      <>
                        {delta > 0 ? 'Need to attend ' : 'Can bunk '}
                        <ThemedText style={{ color: Colors[colorScheme].white }}>
                          {Math.abs(delta)} class{Math.abs(delta) === 1 ? '' : 'es'}
                        </ThemedText>
                      </>
                    ) : (
                      <ThemedText style={{ color: Colors[colorScheme].white }}>
                        {attendanceGuidance}
                      </ThemedText>
                    ) : attendanceGuidance}
                  </ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={Colors[colorScheme].icon}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText numberOfLines={1} style={[styles.courseStatusText, { color: Colors[colorScheme].textSecondary }]}>
                    {isTargetMet
                      ? <ThemedText style={{ color: Colors[colorScheme].white }}>Target Met</ThemedText>
                      : target.targetDate
                        ? <>
                            Target by{' '}
                            <ThemedText style={{ color: Colors[colorScheme].white }}>
                              {target.targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </ThemedText>
                          </>
                        : target.message}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.attendanceMetric}>
                <ThemedText style={[styles.attendanceMetricValue, { color: deltaColor }]}>
                  {attendancePercentage}%
                </ThemedText>
                <ThemedText style={[styles.attendanceMetricLabel, { color: Colors[colorScheme].textSecondary }]}>
                  attendance
                </ThemedText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
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
            onPress={changeSortBy}
            style={[styles.sortButton, { backgroundColor: Colors[colorScheme].cardBackground }]}
          >
            <Ionicons
              name={sortBy === 'alphabetical' ? 'text' : sortBy === 'targetDate' ? 'calendar' : 'stats-chart'}
              size={20}
              color={Colors[colorScheme].tint}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleSortOrder}
            style={[styles.sortButton, { backgroundColor: Colors[colorScheme].cardBackground }]}
          >
            <Ionicons
              name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={20}
              color={Colors[colorScheme].tint}
            />
          </TouchableOpacity>
        </View>
        <Link href="/add-course" asChild>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: Colors[colorScheme].cardBackground }]}>
            <Ionicons
              name="add-circle-outline"
              size={22}
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
    borderRadius: 16,
    marginBottom: 0,
  },
  courseCard: {
    borderRadius: 16,
    padding: 16,
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
  attendanceMetric: {
    minWidth: 54,
    marginLeft: 8,
    marginRight: 8,
    alignItems: 'flex-end',
  },
  attendanceMetricValue: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  attendanceMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  addButton: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortContainer: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 14,
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  courseStatusText: {
    flexShrink: 1,
    fontSize: 13,
  },
});
