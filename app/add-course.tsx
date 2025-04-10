import React, { useState, useContext } from 'react';
import { StyleSheet, View, Button, Alert, Keyboard, TextInput, useColorScheme as useRNColorScheme } from 'react-native'; // Renamed hook import
import Slider from '@react-native-community/slider';
import { Stack, useRouter } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course } from '@/types';
import { Colors } from '@/constants/Colors'; // Import Colors
import { useColorScheme } from '@/hooks/useColorScheme'; // Import app's color scheme hook

export default function AddCourseScreen() {
  const router = useRouter();
  const { addCourse, courses } = useContext(AppContext); // Get courses from context
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [requiredAttendance, setRequiredAttendance] = useState(75);
  const [codeError, setCodeError] = useState<string | null>(null); // State for code error message
  const [nameError, setNameError] = useState<string | null>(null); // State for name error message
  const colorScheme = useColorScheme();

  // Function to round to nearest step
  const roundToStep = (value: number, step: number) => {
    return Math.round(value / step) * step;
  };

  const handleAddCourse = () => {
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
    } else {
      // Check for duplicate course code
      const existingCourse = courses.find(course => course.id.toLowerCase() === trimmedCode.toLowerCase());
      if (existingCourse) {
        setCodeError('Course code already exists.');
        isValid = false;
      }
    }

    if (!trimmedName) {
      setNameError('Please enter a course name.');
      isValid = false;
    }

    if (!isValid) {
      return; // Stop if validation fails
    }

    const newCourse: Course = {
      id: trimmedCode,
      name: trimmedName,
      requiredAttendance: requiredAttendance,
      presents: 0,
      absents: 0,
      cancelled: 0,
      weeklySchedule: [],
      extraClasses: [],
      attendanceRecords: [],
    };

    // Call the addCourse function from context
    addCourse(newCourse);

    Keyboard.dismiss();
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Add New Course' }} />
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
            onChangeText={(text) => {
              setCourseCode(text);
              if (codeError) setCodeError(null); // Clear error on type
            }}
            placeholderTextColor="#999"
            autoCapitalize="characters"
            pointerEvents="auto"
          />
          {codeError && <ThemedText style={styles.errorText}>{codeError}</ThemedText>}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Course Name:</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: Colors[colorScheme ?? 'light'].icon, // Use theme color for border
                color: Colors[colorScheme ?? 'light'].text, // Use theme color for text
                backgroundColor: Colors[colorScheme ?? 'light'].background, // Use theme background
              }
            ]}
            placeholder="e.g., Introduction to Programming"
            value={courseName}
            onChangeText={(text) => {
              setCourseName(text);
              if (nameError) setNameError(null); // Clear error on type
            }}
            placeholderTextColor="#999"
            pointerEvents="auto"
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
            // Use onSlidingComplete for final value, onValueChange for visual feedback (rounded)
            onValueChange={(value) => setRequiredAttendance(roundToStep(value, 5))} // Update visual state rounded to step
            // onSlidingComplete={(value) => setRequiredAttendance(roundToStep(value, 5))} // Optionally use this for final state update if onValueChange is still problematic
            minimumTrackTintColor={Colors[colorScheme ?? 'light'].tint}
            maximumTrackTintColor={Colors[colorScheme ?? 'light'].icon}
            thumbTintColor={Colors[colorScheme ?? 'light'].tint} // Theme tint color
          />
        </View>

        <Button title="Add Course" onPress={handleAddCourse} />
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 20, // Add gap between elements
  },
  inputGroup: {
    gap: 8, // Space between label and input
  },
  label: {
    fontSize: 16,
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    // borderColor: '#ccc', // Replaced by theme color
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    // color: '#333', // Replaced by theme color
    // backgroundColor: '#fff', // Replaced by theme color
  },
  slider: {
    width: '100%',
    height: 50,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginTop: 4, // Add some space below the input
  },
});
