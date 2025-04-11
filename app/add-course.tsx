import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  Keyboard,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course, ScheduleItem } from '@/types';
import { Colors } from '@/constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';

// Function to generate theme-aware styles
const getStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight + 16 : 16,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    flexGrow: 1,
    padding: 20,
    gap: 20, // Add gap between elements
    marginBottom: 200,
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
    width: 40, // or any fixed size
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
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
  addButton: {
    backgroundColor: Colors[colorScheme as 'light' | 'dark'].tint,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: Colors[colorScheme].success,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});

export default function AddCourseScreen() {
  const router = useRouter();
  const { addCourse, courses } = useContext(AppContext);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [requiredAttendance, setRequiredAttendance] = useState(75);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const colorScheme = useColorScheme() ?? 'light';

  const styles = getStyles(colorScheme);
  // State for weekly schedule builder
  const [currentScheduleItems, setCurrentScheduleItems] = useState<ScheduleItem[]>([]);
  const [startTime, setStartTime] = useState(''); // Revert to string state
  const [endTime, setEndTime] = useState(''); // Revert to string state

  const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const [selectedDay, setSelectedDay] = useState('Monday');

  // --- Schedule Management Functions ---
  const handleAddScheduleItem = (selectedDay: string) => {
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
      id: `${selectedDay}-${startTime}-${endTime}-${Date.now()}`,
      day: selectedDay,
      timeStart: startTime,
      timeEnd: endTime,
    };

    // Check for overlapping schedule items
    const isOverlapping = currentScheduleItems.some(item => {
      if (item.day === newItem.day) {
        // Convert times to minutes to midnight for easier comparison
        const itemStartMinutes = parseInt(item.timeStart.split(':')[0]) * 60 + parseInt(item.timeStart.split(':')[1]);
        const itemEndMinutes = parseInt(item.timeEnd.split(':')[0]) * 60 + parseInt(item.timeEnd.split(':')[1]);
        const newItemStartMinutes = parseInt(newItem.timeStart.split(':')[0]) * 60 + parseInt(newItem.timeStart.split(':')[1]);
        const newItemEndMinutes = parseInt(newItem.timeEnd.split(':')[0]) * 60 + parseInt(newItem.timeEnd.split(':')[1]);

        return (
          (newItemStartMinutes < itemEndMinutes && newItemEndMinutes > itemStartMinutes) // New item starts before existing item ends AND new item ends after existing item starts
        );
      }
      return false;
    });

    if (isOverlapping) {
      setScheduleError('This schedule slot overlaps with an existing one.');
      return;
    }

    setCurrentScheduleItems([...currentScheduleItems, newItem]);
    setStartTime('');
    setEndTime('');
  };

  const handleRemoveScheduleItem = (idToRemove: string) => {
    setCurrentScheduleItems(currentScheduleItems.filter(item => item.id !== idToRemove));
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
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      {/* Consistent Title Container */}
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={{ color: Colors[colorScheme].text }}>
          Add New Course
        </ThemedText>
      </ThemedView>
      <ScrollView>
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
              onValueChange={(value) => setRequiredAttendance(value)} // Update visual state rounded to step
              onSlidingComplete={(value) => setRequiredAttendance(value)} // Optionally use this for final state update if onValueChange is still problematic
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
                {DAYS_OF_WEEK.map(day => {
                  const isSelected = selectedDay === day;
                  const themeColors = Colors[colorScheme ?? 'light'];

                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayButton,
                        isSelected && styles.dayButtonSelected,
                        { backgroundColor: isSelected ? themeColors.tint : themeColors.background }
                      ]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <ThemedText style={
                        {
                          fontWeight: 'bold',
                          color: isSelected ?
                            themeColors.background
                            : day === 'Sunday'
                              ? 'red'
                              : themeColors.text
                        }}>
                        {day[0]}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
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
            <TouchableOpacity style={styles.addButton} onPress={() => handleAddScheduleItem(selectedDay)}>
              <ThemedText style={styles.addButtonText}>Add Class Time</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Display Added Schedule Items */}
          {currentScheduleItems.length > 0 && (
            <View style={styles.scheduleListContainer}>
              <ThemedText type="defaultSemiBold">Class Times:</ThemedText>
              {currentScheduleItems.map((item) => (
                <View style={styles.scheduleListItem} key={item.id}>
                  <ThemedText>{item.day}, {item.timeStart} - {item.timeEnd}</ThemedText>
                  <TouchableOpacity onPress={() => handleRemoveScheduleItem(item.id)}>
                    <Ionicons name="trash-outline" size={20} color="red" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {/* --- End Weekly Schedule Section --- */}

          <TouchableOpacity style={styles.saveButton} onPress={handleAddCourse}>
            <ThemedText style={styles.saveButtonText}>Save Course</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexGrow: 1,
    padding: 20,
    gap: 20, // Add gap between elements
    marginBottom: 200,
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
    width: 40, // or any fixed size
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
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
  addButton: {
    backgroundColor: Colors[colorScheme || 'light'].foreground,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: Colors[colorScheme || 'light'].success,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
