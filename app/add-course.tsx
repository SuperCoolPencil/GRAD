import React, { useState, useContext } from 'react';
import { View, TextInput, StyleSheet, Alert, useColorScheme, TouchableOpacity, Platform, ScrollView } from 'react-native'; // Added TouchableOpacity, Platform
import { Button, Provider } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '@/context/AppContext'; // Updated path
import { Colors } from '@/constants/Colors'; // Updated path
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useRouter } from 'expo-router'; // Added for potential navigation back
import { ScheduleItem } from '@/types';

const AddCourseScreen = () => {
  const router = useRouter(); // Added router
  const { addCourse } = useContext(AppContext);
  const [courseName, setCourseName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleItem[]>([]);
  const colorScheme = useColorScheme() ?? 'light';
  const styles = getStyles(colorScheme); // Generate styles based on theme

  const handleSubmit = async () => { // Made async for potential future async operations
    if (!courseName || !courseId) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    try {
      await addCourse({
        id: courseId,
        name: courseName,
        presents: 0,
        absents: 0,
        cancelled: 0,
        weeklySchedule: weeklySchedule,
        attendanceRecords: [],
        extraClasses: [],
        requiredAttendance: 0,
      });
      Alert.alert("Success", "Course added!");
      // Optionally navigate back or clear form
      setCourseName("");
      setCourseId("");
      setWeeklySchedule([]);
      setSelectedDay(null);
      setStartTime(null);
      setEndTime(null);
      // router.back(); // Example: navigate back after success
    } catch (error) {
      console.error("Failed to add course:", error);
      Alert.alert("Error", "Failed to add course. Please try again.");
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      {/* Consistent Title Container */}
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={{ color: Colors[colorScheme].text }}>
          Add Course
        </ThemedText>
      </ThemedView>

      {/* Form Content */}
      <ThemedView style={styles.contentContainer}>
        
      <ThemedText style={styles.label}>Course Name:</ThemedText>
        <TextInput
          style={styles.input}
          value={courseName}
          onChangeText={setCourseName}
          placeholder="Enter Course Name (e.g., Calculus)"
          placeholderTextColor={Colors[colorScheme].placeholder}
          keyboardType="default" // Adjust keyboard type if needed
          autoCapitalize="sentences"
      />

      <ThemedText style={styles.label}>Course ID:</ThemedText>
        <TextInput
          style={styles.input}
          value={courseId}
          onChangeText={setCourseId}
          placeholder="Enter Course ID (e.g., MA102)"
          placeholderTextColor={Colors[colorScheme].placeholder}
          keyboardType="default" // Adjust keyboard type if needed
          autoCapitalize="characters"
      />

      <ThemedText style={styles.label}>Select Day:</ThemedText>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayButton,
              selectedDay === day && styles.dayButtonSelected,
            ]}
            onPress={() => setSelectedDay(day)}
          >
            <ThemedText style={styles.dayButtonText}>{day}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <ThemedText style={styles.label}>Start Time:</ThemedText>
      <TouchableOpacity onPress={() => setShowStartTimePicker(true)}>
        <ThemedText>
          {startTime ? startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Select Start Time'}
        </ThemedText>
      </TouchableOpacity>
      {showStartTimePicker && (
        <DateTimePicker
          value={startTime || new Date()}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={(event, selectedTime) => {
            setShowStartTimePicker(false);
            if (selectedTime) {
              setStartTime(selectedTime);
            }
          }}
        />
      )}

      <ThemedText style={styles.label}>End Time:</ThemedText>
      <TouchableOpacity onPress={() => setShowEndTimePicker(true)}>
        <ThemedText>
          {endTime ? endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Select End Time'}
        </ThemedText>
      </TouchableOpacity>
      {showEndTimePicker && (
        <DateTimePicker
          value={endTime || new Date()}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={(event, selectedTime) => {
            setShowEndTimePicker(false);
            if (selectedTime) {
              setEndTime(selectedTime);
            }
          }}
        />
      )}

        {/* Themed Button */}
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <ThemedText style={styles.buttonText}>Add Course</ThemedText>
        </TouchableOpacity>
         <TouchableOpacity style={styles.button} onPress={() => {
           if (selectedDay && startTime && endTime) {
             const newScheduleItem: ScheduleItem = {
               id: Date.now().toString(),
               day: selectedDay,
               timeStart: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
               timeEnd: endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
             };
             setWeeklySchedule([...weeklySchedule, newScheduleItem]);
             Alert.alert("Success", "Weekly class added!");
           } else {
             Alert.alert("Error", "Please select day, start time, and end time.");
           }
         }}>
          <ThemedText style={styles.buttonText}>Add Weekly Class</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
  );
};

// Function to generate theme-aware styles
const getStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Adjust as needed (e.g., 'flex-start' if no close button)
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 + 16 : 16,
    paddingBottom: 16, // Consistent padding
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: Colors[colorScheme].text,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors[colorScheme].border, // Themed border
    backgroundColor: Colors[colorScheme].inputBackground, // Themed input background
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    color: Colors[colorScheme].text, // Themed text color
  },
  button: {
    backgroundColor: Colors[colorScheme].tint, // Themed button background
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10, // Add some margin top
  },
  buttonText: {
    color: Colors[colorScheme].buttonText || '#FFFFFF', // Themed button text (default white)
    fontSize: 16,
    fontWeight: 'bold',
  },
  dayButton: {
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].background,
  },
  dayButtonSelected: {
    backgroundColor: Colors[colorScheme].tint,
  },
  dayButtonText: {
    color: Colors[colorScheme].text,
  },
  timePickerButton: {
    backgroundColor: Colors[colorScheme].tint,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  timePickerText: {
    color: Colors[colorScheme].buttonText || '#FFFFFF',
    fontSize: 16,
  },
});

export default AddCourseScreen
