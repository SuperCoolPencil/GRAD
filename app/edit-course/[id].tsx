import React, { useState, useContext, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { AppContext } from '@/context/AppContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCustomAlert } from '@/context/AlertContext';
import CustomHeader from '@/components/CustomHeader';
import CourseForm from '@/components/CourseForm';
import { Course } from '@/types';
import { ThemedText } from '@/components/ThemedText';

const EditCourseScreen = () => {
  const router = useRouter();
  const { updateCourse, getCourse } = useContext(AppContext);
  const { showAlert } = useCustomAlert();
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
      <CustomHeader title={`Edit Course (ID: ${id})`} />
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
});

export default EditCourseScreen;
