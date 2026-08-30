import React, { useState, useContext, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppContext } from '@/context/AppContext';
// Removed Picker import
import { Colors } from '@/constants/Colors';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useRouter } from 'expo-router';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { useCustomAlert } from '@/context/AlertContext'; // Import the custom alert hook
import CustomHeader from '@/components/CustomHeader';
import { formatTime as formatTimeUtil } from '@/utils/time';
import { formatDateToISO, formatTimeTo24H } from '@/utils/dateHelpers';
import { CoursePicker } from '@/components/CoursePicker';

const AddExtraClassScreen = () => {
  const router = useRouter();
  const { addExtraClass, courses, is24Hour } = useContext(AppContext);
  const colorScheme = useColorScheme() ?? 'light';
  const { colors } = useTheme();
  const { showAlert } = useCustomAlert(); // Use the custom alert hook

  // State variables
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null); // Initialize to null for placeholder

  // Time picker state
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Generate styles based on theme
  const styles = useMemo(() => getStyles(colorScheme, colors), [colorScheme, colors]);

  useFocusEffect(
    useCallback(() => {
      setDate(new Date());
    }, [])
  );

  // Helper functions
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    const timeString = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatTimeUtil(timeString, is24Hour);
  };

  const getTimeForStorage = formatTimeTo24H;

  // Date picker handler
  const handleDateChange = (event: DateTimePickerEvent, selectedDate: Date | undefined) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  // Time picker handlers
  const handleStartTimeChange = (event: DateTimePickerEvent, selectedTime: Date | undefined) => {
    setShowStartTimePicker(false);
    if (selectedTime) {
      setStartTime(selectedTime);
    }
  };

  const handleEndTimeChange = (event: DateTimePickerEvent, selectedTime: Date | undefined) => {
    setShowEndTimePicker(false);
    if (selectedTime) {
      setEndTime(selectedTime);
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (selectedCourse === null) { // Check against null explicitly
      showAlert("Error", "Please select a course.");
      return;
    }

    if (!startTime) {
      showAlert("Error", "Please select a start time.");
      return;
    }

    if (!endTime) {
      showAlert("Error", "Please select an end time.");
      return;
    }

    if (startTime >= endTime) {
      showAlert("Error", "End time must be after start time.");
      return;
    }

    const start = getTimeForStorage(startTime);
    const end = getTimeForStorage(endTime);
    const course = courses.find(item => item.id === selectedCourse);
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    const overlaps = [
      ...(course?.weeklySchedule?.filter(item => item.day === dayName) || []),
      ...(course?.extraClasses?.filter(item => item.date === formatDateToISO(date)) || []),
    ].some(item => start < item.timeEnd && end > item.timeStart);
    if (overlaps) {
      showAlert('Error', 'This extra class overlaps another class in the selected course.');
      return;
    }

    try {
      await addExtraClass(
        selectedCourse,
        formatDateToISO(date),  // date should be YYYY-MM-DD format
        start,
        end,
      );

      showAlert("Success", "Extra class added successfully!", [
        {
          text: "Add Another",
          onPress: resetForm
        },
        {
          text: "Done",
          onPress: () => router.back()
        }
      ]);
    } catch (error) {
      console.error("Failed to add extra class:", error);
      showAlert("Error", "Failed to add extra class. Please try again.");
    }
  };

  const resetForm = () => {
    setDate(new Date());
    setStartTime(null);
    setEndTime(null);
    setSelectedCourse(null); // Reset selected course
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <CustomHeader title="Add Extra Class" />
      <ScrollView style={styles.contentContainer}>
        {/* Form Content */}
        <View style={styles.section}>
          {/* Course Selection */}
          <CoursePicker
            label="Course:"
            courses={courses}
            selectedCourseIds={selectedCourse ? [selectedCourse] : []}
            onSelectionChange={(ids) => setSelectedCourse(ids.length > 0 ? ids[0] : null)}
            multiSelect={false} // Single select mode
            allCoursesOption={false} // No "All Courses" option for single select
            showArchivedToggle={false} // Show archived courses toggle
            showSaveButton={false} // Always show save button
          />
          {/* End Course Selection */}

          {/* Date Selection */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Date:</ThemedText>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <ThemedText style={styles.datePickerText}>
                {formatDate(date)}
              </ThemedText>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                onChange={handleDateChange}
              />
            )}
          </View>

          {/* Time selection */}
          <View style={styles.timeContainer}>
            <View style={styles.timeSection}>
              <ThemedText style={styles.label}>Start Time:</ThemedText>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <ThemedText style={styles.timePickerText}>
                  {startTime ? formatTime(startTime) : 'Select Start Time'}
                </ThemedText>
              </TouchableOpacity>
              {showStartTimePicker && (
                <DateTimePicker
                  value={startTime || new Date()}
                  mode="time"
                  is24Hour={is24Hour}
                  onChange={handleStartTimeChange}
                />
              )}
            </View>

            <View style={styles.timeSection}>
              <ThemedText style={styles.label}>End Time:</ThemedText>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <ThemedText style={styles.timePickerText}>
                  {endTime ? formatTime(endTime) : 'Select End Time'}
                </ThemedText>
              </TouchableOpacity>
              {showEndTimePicker && (
                <DateTimePicker
                  value={endTime || new Date()}
                  mode="time"
                  is24Hour={is24Hour}
                  onChange={handleEndTimeChange}
                />
              )}
            </View>
          </View>
          {/* Submit Button */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
            <ThemedText style={styles.primaryButtonText}>Add Extra Class</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

// Function to generate theme-aware styles
const getStyles = (colorScheme: 'light' | 'dark', colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 20,
    color: Colors[colorScheme].text,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: Colors[colorScheme].text,
    fontWeight: '500',
  },
  input: {
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors[colorScheme].text,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    backgroundColor: Colors[colorScheme].card,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderColor: Colors[colorScheme].border,
  },
  datePickerText: {
    color: Colors[colorScheme].text,
    fontSize: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeSection: {
    flex: 1,
    marginRight: 10,
  },
  timePickerButton: {
    backgroundColor: Colors[colorScheme].card,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderColor: Colors[colorScheme].border,
  },
  timePickerText: {
    color: Colors[colorScheme].text,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: Colors[colorScheme].tint,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AddExtraClassScreen;
