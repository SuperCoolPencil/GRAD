import React, { useState, useContext } from 'react';
import { StyleSheet, View, Button, Alert, Keyboard, TextInput, FlatList, TouchableOpacity, useColorScheme as useRNColorScheme } from 'react-native'; // Removed Platform, DateTimePicker
import Slider from '@react-native-community/slider';
import { Stack, useRouter } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course, ScheduleItem } from '@/types';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function AddCourseScreen() {
  const router = useRouter();
  const { addCourse, courses } = useContext(AppContext); // Get courses from context
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [requiredAttendance, setRequiredAttendance] = useState(75);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null); // State for schedule input errors
  const colorScheme = useColorScheme();

  // State for weekly schedule builder
  const [currentScheduleItems, setCurrentScheduleItems] = useState<ScheduleItem[]>([]);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [startTime, setStartTime] = useState(''); // Revert to string state
  const [endTime, setEndTime] = useState(''); // Revert to string state

  const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Function to round to nearest step
  const roundToStep = (value: number, step: number) => {
    return Math.round(value / step) * step;
  };

  // --- Schedule Management Functions ---
  const handleAddScheduleItem = () => {
    setScheduleError(null); // Reset error

    // Basic time format validation (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      setScheduleError('Please enter valid start and end times in HH:MM format (e.g., 09:00).');
      return;
    }

    // Check if start time is before end time
    const start = startTime.split(':').map(Number);
    const end = endTime.split(':').map(Number);
    if (start[0] > end[0] || (start[0] === end[0] && start[1] >= end[1])) {
       setScheduleError('Start time must be before end time.');
       return;
    }

    const newItem: ScheduleItem = {
      id: `${selectedDay}-${startTime}-${endTime}-${Date.now()}`, // Use string times for ID
      day: selectedDay,
      timeStart: startTime, // Use string time
      timeEnd: endTime, // Use string time
    };
    setCurrentScheduleItems([...currentScheduleItems, newItem]);
    // Optionally reset time fields
    // setStartTime('');
    // setEndTime('');
  };

  const handleRemoveScheduleItem = (idToRemove: string) => {
    setCurrentScheduleItems(currentScheduleItems.filter(item => item.id !== idToRemove));
  };
  // --- End Schedule Management ---


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
      weeklySchedule: currentScheduleItems, // Add the collected schedule items
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
            thumbTintColor={Colors[colorScheme ?? 'light'].tint}
          />
        </View>

        {/* --- Weekly Schedule Section --- */}
        <ThemedText type="subtitle" style={styles.sectionTitle}>Weekly Schedule</ThemedText>
        <View style={styles.scheduleInputContainer}>
          {/* Day Picker (Simplified) - Consider a proper Picker component later */}
          <View style={styles.scheduleInputGroup}>
             <ThemedText style={styles.label}>Day:</ThemedText>
             {/* Basic buttons for day selection - Replace with Picker */}
             <View style={styles.daySelector}>
                {DAYS_OF_WEEK.map(day => (
                    <TouchableOpacity
                        key={day}
                        style={[
                            styles.dayButton,
                            selectedDay === day && styles.dayButtonSelected,
                            { backgroundColor: selectedDay === day ? Colors[colorScheme ?? 'light'].tint : Colors[colorScheme ?? 'light'].background }
                        ]}
                        onPress={() => setSelectedDay(day)}
                    >
                        <ThemedText style={{ color: selectedDay === day ? Colors[colorScheme ?? 'light'].background : Colors[colorScheme ?? 'light'].text }}>
                            {day.substring(0, 3)}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
             </View>
          </View>

          <View style={styles.scheduleInputGroupRow}>
            {/* Start Time Input */}
            <View style={styles.timeInputGroup}>
              <ThemedText style={styles.label}>Start Time:</ThemedText>
              <TextInput
                style={[styles.input, styles.timeInput, { borderColor: Colors[colorScheme ?? 'light'].icon, color: Colors[colorScheme ?? 'light'].text, backgroundColor: Colors[colorScheme ?? 'light'].background }]}
                placeholder="HH:MM"
                value={startTime}
                onChangeText={(text) => {
                    setStartTime(text);
                    if (scheduleError) setScheduleError(null); // Clear error on type
                }}
                maxLength={5}
                keyboardType="numbers-and-punctuation" // Allows ':'
                placeholderTextColor="#999"
              />
            </View>
            {/* End Time Input */}
            <View style={styles.timeInputGroup}>
              <ThemedText style={styles.label}>End Time:</ThemedText>
              <TextInput
                style={[styles.input, styles.timeInput, { borderColor: Colors[colorScheme ?? 'light'].icon, color: Colors[colorScheme ?? 'light'].text, backgroundColor: Colors[colorScheme ?? 'light'].background }]}
                placeholder="HH:MM"
                value={endTime}
                 onChangeText={(text) => {
                    setEndTime(text);
                    if (scheduleError) setScheduleError(null); // Clear error on type
                }}
                maxLength={5}
                keyboardType="numbers-and-punctuation" // Allows ':'
                placeholderTextColor="#999"
              />
            </View>
          </View>
          {scheduleError && <ThemedText style={styles.errorText}>{scheduleError}</ThemedText>}
          <Button title="Add Schedule Slot" onPress={handleAddScheduleItem} />
        </View>

         {/* Display Added Schedule Items */}
        {currentScheduleItems.length > 0 && (
          <View style={styles.scheduleListContainer}>
            <ThemedText type="defaultSemiBold">Scheduled Slots:</ThemedText>
            <FlatList
              data={currentScheduleItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.scheduleListItem}>
                  <ThemedText>{item.day}, {item.timeStart} - {item.timeEnd}</ThemedText>
                  <TouchableOpacity onPress={() => handleRemoveScheduleItem(item.id)}>
                    <Ionicons name="trash-outline" size={20} color="red" />
                  </TouchableOpacity>
                </View>
              )}
              scrollEnabled={false} // Prevent nested scrolling issues
            />
          </View>
        )}
        {/* --- End Weekly Schedule Section --- */}


        <Button title="Save Course" onPress={handleAddCourse} />
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
    marginTop: 4,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee', // Light separator
    paddingTop: 16,
  },
  scheduleInputContainer: {
    gap: 16,
    marginBottom: 16,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd', // Light border for the section
  },
  scheduleInputGroup: {
    gap: 8,
  },
   scheduleInputGroupRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end', // Align items nicely if labels are different heights
  },
  timeInputGroup: {
    flex: 1, // Each time input takes half the space
    gap: 8,
  },
  timeInput: {
    // Specific styles for time input if needed, inherits from styles.input
  },
  daySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow buttons to wrap
    gap: 8,
  },
  dayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  dayButtonSelected: {
    borderColor: Colors.light.tint, // Use tint color for selected border
    // Background color is set dynamically
  },
  scheduleListContainer: {
    marginTop: 10,
    gap: 8,
  },
  scheduleListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
});
