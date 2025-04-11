import React, { useState, useContext, useEffect } from 'react';
import { StyleSheet, View, Button, TextInput, Alert, Keyboard } from 'react-native';
import Slider from '@react-native-community/slider';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course } from '@/types';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function EditCourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { courses, updateCourse } = useContext(AppContext);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [requiredAttendance, setRequiredAttendance] = useState(75);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const [course, setCourse] = useState<Course | null>(null);

  useEffect(() => {
    const foundCourse = courses.find(c => c.id === id);
    if (foundCourse) {
      setCourse(foundCourse);
      setCourseCode(foundCourse.id);
      setCourseName(foundCourse.name);
      setRequiredAttendance(foundCourse.requiredAttendance);
    } else {
      Alert.alert('Error', 'Course not found.');
      router.back();
    }
  }, [id, courses]);

  const handleSaveChanges = () => {
    const trimmedCode = courseCode.trim();
    const trimmedName = courseName.trim();
    let isValid = true;

    // Reset errors
    setCodeError(null);
    setNameError(null);

    // Validation
    if (!trimmedCode) {
      setCodeError('Please enter a course code.');
      isValid = false;
    }
    if (!trimmedName) {
      setNameError('Please enter a course name.');
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    if (!course) return;

    const updatedCourse: Course = {
      ...course,
      id: trimmedCode,
      name: trimmedName,
      requiredAttendance: requiredAttendance,
    };

    console.log('Updated course data:', updatedCourse); // Add console log
    updateCourse(updatedCourse);
    Keyboard.dismiss();
    router.back();
  };

  const roundToStep = (value: number, step: number) => {
    return Math.round(value / step) * step;
  };

  if (!course) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Edit Course ${course.name}` }} />
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Course Details</ThemedText>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Course Code:</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: Colors[colorScheme ?? 'light'].icon,
                color: Colors[colorScheme ?? 'light'].text,
                backgroundColor: Colors[colorScheme ?? 'light'].background,
              }
            ]}
            placeholder="e.g., MA102"
            value={courseCode}
            onChangeText={setCourseCode}
            placeholderTextColor="#999"
            autoCapitalize="characters"
          />
          {codeError && <ThemedText style={styles.errorText}>{codeError}</ThemedText>}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Course Name:</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: Colors[colorScheme ?? 'light'].icon,
                color: Colors[colorScheme ?? 'light'].text,
                backgroundColor: Colors[colorScheme ?? 'light'].background,
              }
            ]}
            placeholder="e.g., Introduction to Programming"
            value={courseName}
            onChangeText={setCourseName}
            placeholderTextColor="#999"
          />
          {nameError && <ThemedText style={styles.errorText}>{nameError}</ThemedText>}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Required Attendance: {requiredAttendance}%</ThemedText>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            step={5}
            value={requiredAttendance}
            onValueChange={(value) => setRequiredAttendance(roundToStep(value, 5))}
            minimumTrackTintColor={Colors[colorScheme ?? 'light'].tint}
            maximumTrackTintColor={Colors[colorScheme ?? 'light'].icon}
            thumbTintColor={Colors[colorScheme ?? 'light'].tint}
          />
        </View>

        <Button title="Save Changes" onPress={handleSaveChanges} />
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginTop: 4,
  },
});
