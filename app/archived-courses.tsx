import { StyleSheet, FlatList, TouchableOpacity, View, Platform, Pressable } from 'react-native';
import { useContext } from 'react';
import { Link, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useCustomAlert } from '@/context/AlertContext';
import Ionicons from '@expo/vector-icons/Ionicons';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AppContext } from '@/context/AppContext';
import { Course } from '@/types';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import TopBar from '@/components/TopBar';

export default function ArchivedCoursesScreen() {
  const { courses } = useContext(AppContext);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { unarchiveCourse } = useContext(AppContext);

  return (
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="title"
          numberOfLines={1}
          style={[{ color: Colors[colorScheme].text }]}
        >
          Archived Courses
        </ThemedText>
      </ThemedView>
      <ArchivedCoursesContent
        courses={courses}
        colorScheme={colorScheme}
        router={router}
      />
    </View>
  );
}

function ArchivedCoursesContent({ courses, colorScheme, router }: { courses: Course[]; colorScheme: 'light' | 'dark'; router: any }) {
  const archivedCourses = courses.filter(course => course.isArchived === true);
  const { unarchiveCourse } = useContext(AppContext);
  const { showAlert } = useCustomAlert();

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

    const getAccentColor = () => {
      if (attendancePercentage >= item.requiredAttendance)
        return Colors[colorScheme].success;
      if (attendancePercentage >= item.requiredAttendance - 10)
        return Colors[colorScheme].warning;
      return Colors[colorScheme].error;
    };

    const accentColor = getAccentColor();

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
              <Pressable onPress={() => handleUnarchive(item)}>
                <Ionicons
                  name="arrow-up-circle-outline"
                  size={32}
                  color={Colors[colorScheme].icon}
                />
              </Pressable>
            </ThemedView>
          </ThemedView>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={archivedCourses}
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
  titleContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight + 16 : 32,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: 'space-between',
  },
  coursesList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  courseCardContainer: {
    borderLeftWidth: 4,
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
  },
  courseInfo: {
    flex: 1,
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
