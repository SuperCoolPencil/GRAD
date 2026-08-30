import React, { useState, useContext, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, useColorScheme } from 'react-native';
import { AppContext } from '@/context/AppContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCustomAlert } from '@/context/AlertContext';
import CustomHeader from '@/components/CustomHeader';
import CourseForm from '@/components/CourseForm';
import { Course } from '@/types';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

const EditCourseScreen = () => {
  const router = useRouter();
  const { updateCourse, getCourse, archiveCourse, unarchiveCourse } = useContext(AppContext);
  const { showAlert } = useCustomAlert();
  const colorScheme = useColorScheme() ?? 'light';
  const { id } = useLocalSearchParams();
  const [initialData, setInitialData] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourseData = async () => {
      if (id) {
        try {
          const course = await getCourse(id as string);
          if (course) {
            setInitialData(course);
          } else {
            showAlert("Error", "Course not found.");
          }
        } catch (error) {
          console.error("Failed to fetch course:", error);
          showAlert("Error", "Failed to fetch course. Please try again.");
        } finally {
          setLoading(false);
        }
      }
    };

    fetchCourseData();
  }, [id, getCourse, showAlert]);

  const handleSubmit = async (courseData: Course) => {
    try {
      await updateCourse(courseData);
      showAlert("Success", "Course edited successfully!", [
        {
          text: "Done",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("Failed to edit course:", error);
      showAlert("Error", "Failed to edit course. Please try again.");
    }
  };

  const handleArchiveToggle = () => {
    if (!initialData) return;
    if (initialData.isArchived) {
      showAlert(
        'Unarchive Course',
        `Are you sure you want to unarchive "${initialData.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unarchive',
            style: 'destructive',
            onPress: () => {
              unarchiveCourse(initialData.id);
              router.back();
            },
          },
        ]
      );
    } else {
      showAlert(
        'Archive Course',
        `Archived courses no longer appear in your courses list, weekly schedules, analytics page and DO NOT trigger notifications.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            style: 'destructive',
            onPress: () => {
              archiveCourse(initialData.id);
              router.back();
            },
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading course...</ThemedText>
      </View>
    );
  }

  if (!initialData) {
    return (
      <View style={styles.centered}>
        <ThemedText>Course not found.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader
        title={`Edit Course (ID: ${id})`}
        rightElement={
          <TouchableOpacity
            onPress={handleArchiveToggle}
            style={styles.headerIconButton}
          >
            <Ionicons
              name={initialData.isArchived ? "arrow-up-circle-outline" : "archive-outline"}
              size={24}
              color={initialData.isArchived ? Colors[colorScheme].tint : Colors[colorScheme].warning}
            />
          </TouchableOpacity>
        }
      />
      <CourseForm
        onSubmit={handleSubmit}
        isEditing={true}
        initialData={initialData}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default EditCourseScreen;
