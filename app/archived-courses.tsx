import { StyleSheet, FlatList, TouchableOpacity, View } from 'react-native';
import { useContext, useState } from 'react';
import { useRouter } from 'expo-router';
import { useCustomAlert } from '@/context/AlertContext';
import CustomHeader from '@/components/CustomHeader';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AppContext } from '@/context/AppContext';
import { Course } from '@/types';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const truncate = (value: string, length: number) => value.length > length ? `${value.slice(0, length - 1)}...` : value;

export default function ArchivedCoursesScreen() {
  const { courses } = useContext(AppContext);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const [sortBy, setSortBy] = useState<'attendance' | 'alphabetical'>('attendance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const headerRightControls = (
    <View style={styles.sortContainer}>
      <TouchableOpacity
        onPress={() => setSortBy(sortBy === 'attendance' ? 'alphabetical' : 'attendance')}
        style={[styles.sortButton, { backgroundColor: Colors[colorScheme].cardBackground }]}
      >
        <Ionicons
          name={sortBy === 'alphabetical' ? 'text' : 'stats-chart'}
          size={20}
          color={Colors[colorScheme].tint}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        style={[styles.sortButton, { backgroundColor: Colors[colorScheme].cardBackground }]}
      >
        <Ionicons
          name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
          size={20}
          color={Colors[colorScheme].tint}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      <CustomHeader title="Archived Courses" rightElement={headerRightControls} />
      <ArchivedCoursesContent
        courses={courses}
        colorScheme={colorScheme}
        router={router}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
    </View>
  );
}

function ArchivedCoursesContent({
  courses,
  colorScheme,
  router,
  sortBy,
  sortOrder,
}: {
  courses: Course[];
  colorScheme: 'light' | 'dark';
  router: any;
  sortBy: 'attendance' | 'alphabetical';
  sortOrder: 'asc' | 'desc';
}) {
  const { unarchiveCourse } = useContext(AppContext);
  const { showAlert } = useCustomAlert();

  const archivedCourses = courses.filter(course => course.isArchived === true);

  const sortedCourses = [...archivedCourses].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    } else {
      const percentageA = a.attendancePercentage || 0;
      const percentageB = b.attendancePercentage || 0;
      return sortOrder === 'asc' ? percentageA - percentageB : percentageB - percentageA;
    }
  });

  const handleUnarchive = (item: Course) => {
    showAlert(
      'Unarchive Course',
      `Are you sure you want to unarchive ${item.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unarchive',
          style: 'destructive',
          onPress: () => {
            unarchiveCourse(item.id);
          },
        },
      ]
    );
  };

  const renderCourseItem = ({ item }: { item: Course }) => {
    const attendancePercentage = item.attendancePercentage || 0;
    const requiredAttendance = item.requiredAttendance || 75;

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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ThemedText
                    type="subtitle"
                    style={{ color: Colors[colorScheme].text }}
                  >
                    {truncate(item.name, 24)}
                  </ThemedText>
                </View>
                <View style={styles.attendanceRow}>
                  <ThemedText style={{ fontSize: 13, color: Colors[colorScheme].textSecondary }}>
                    Attendance {attendancePercentage}% · Target {requiredAttendance}%
                  </ThemedText>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleUnarchive(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.unarchiveButton}
              >
                <Ionicons
                  name="arrow-up-circle-outline"
                  size={28}
                  color={Colors[colorScheme].tint}
                />
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={sortedCourses}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      renderItem={renderCourseItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.coursesList}
      ListEmptyComponent={() => (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            No courses have been archived yet.
          </ThemedText>
        </ThemedView>
      )}
      removeClippedSubviews={false}
    />
  );
}

const styles = StyleSheet.create({
  coursesList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 16,
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
  unarchiveButton: {
    padding: 4,
    marginLeft: 8,
  },
  sortContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
