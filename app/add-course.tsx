import React, { useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppContext } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import { useCustomAlert } from '@/context/AlertContext';
import CustomHeader from '@/components/CustomHeader';
import CourseForm from '@/components/CourseForm';
import { Course } from '@/types';

const AddCourseScreen = () => {
  const { addCourse } = useContext(AppContext);
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [formKey, setFormKey] = useState(Date.now().toString());

  const handleSubmit = async (courseData: Course) => {
    try {
      await addCourse(courseData);
      showAlert("Success", "Course added successfully!", [
        {
          text: "Add Another",
          onPress: () => {
            setFormKey(Date.now().toString());
          }
        },
        {
          text: "Done",
          onPress: () => router.back()
        }
      ]);
    } catch (error) {
      console.error("Failed to add course:", error);
      showAlert("Error", "Failed to add course. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <CustomHeader title="New course" />
      <CourseForm
        key={formKey}
        onSubmit={handleSubmit}
        isEditing={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AddCourseScreen;
