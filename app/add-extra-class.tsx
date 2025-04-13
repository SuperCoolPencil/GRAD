import React, { useState, useContext, useMemo } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Platform,
  ScrollView,
  Modal, // Import Modal
  FlatList // Import FlatList for options
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppContext } from '@/context/AppContext';
import { Course } from '@/types';
// Removed Picker import
import { Colors } from '@/constants/Colors';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import { ThemedView } from '@/components/ThemedView';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useCustomAlert } from '@/context/AlertContext'; // Import the custom alert hook
import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect } from 'react';

const AddExtraClassScreen = () => {
  const router = useRouter();
  const { addExtraClass, courses } = useContext(AppContext);
  const navigation = useNavigation();
  const colorScheme = useColorScheme() ?? 'light';
  const { colors } = useTheme();
  const { showAlert } = useCustomAlert(); // Use the custom alert hook

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Add Extra Class',
      headerStyle: {
        backgroundColor: Colors[colorScheme].card,
      },
    });
  }, [navigation, colors]);

  // State variables
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null); // Initialize to null for placeholder
  const [isPickerVisible, setIsPickerVisible] = useState(false); // State for modal visibility

  // Time picker state
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Generate styles based on theme
  const styles = useMemo(() => getStyles(colorScheme, colors), [colorScheme, colors]);

  // Helper functions
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTimeForStorage = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

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

    try {
      await addExtraClass(
        selectedCourse,
        date.toISOString().split('T')[0],  // date should be YYYY-MM-DD format
        startTime ? getTimeForStorage(startTime) : '',
        endTime ? getTimeForStorage(endTime) : ''
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
    <ThemedView style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView style={styles.contentContainer}>
        {/* Form Content */}
        <View style={styles.section}>

          {/* Course Selection - Replaced Picker with TouchableOpacity + Modal */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Course:</ThemedText>
            <TouchableOpacity
              style={styles.pickerTrigger} // Use a new style for the trigger
              onPress={() => setIsPickerVisible(true)}
            >
              <ThemedText style={styles.pickerTriggerText}>
                {selectedCourse 
                  ? courses.find(c => c.id === selectedCourse)?.name ?? 'Select a course...' // Show selected course name
                  : 'Select a course...'} 
              </ThemedText>
              {/* Add a dropdown icon */}
              <Ionicons name="chevron-down" size={20} color={Colors[colorScheme].text} />
            </TouchableOpacity>

            {/* Course Selection Modal */}
            <Modal
              transparent={true}
              visible={isPickerVisible}
              animationType="fade"
              onRequestClose={() => setIsPickerVisible(false)}
            >
              <TouchableOpacity 
                style={styles.modalContainer} 
                activeOpacity={1} 
                onPressOut={() => setIsPickerVisible(false)} // Close on outside click
              >
                <View style={styles.modalContent} onStartShouldSetResponder={() => true}> 
                  <FlatList
                    data={courses}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalItem}
                        onPress={() => {
                          setSelectedCourse(item.id);
                          setIsPickerVisible(false);
                        }}
                      >
                        <ThemedText style={styles.modalItemText}>
                          {`${item.name} (${item.id})`}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={<ThemedText style={styles.modalItemText}>No courses available</ThemedText>}
                  />
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setIsPickerVisible(false)}
                  >
                    <ThemedText style={styles.modalCloseButtonText}>Close</ThemedText>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
            {/* End Course Selection Modal */}
          </View>
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
                  is24Hour={false}
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
                  is24Hour={false}
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
  // pickerContainer style definition removed as it's merged into picker
  picker: {
    // Styles previously in pickerContainer merged here:
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 10,
    // Original picker styles:
    color: Colors[colorScheme].text,
    height: 50, 
    // Note: Direct styling of Picker items can be inconsistent across platforms.
    // Consider a custom dropdown component for better control if needed.
  },
  pickerItem: { // Basic item style (might need platform-specific adjustments)
    color: Colors[colorScheme].text, 
    height: 50,
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
  // Styles for the custom picker trigger
  pickerTrigger: {
    flexDirection: 'row', // Align text and icon horizontally
    justifyContent: 'space-between', // Space between text and icon
    alignItems: 'center', // Align items vertically
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    height: 50, // Match previous picker height
  },
  pickerTriggerText: {
    color: Colors[colorScheme].text,
    fontSize: 16, // Match input text size
  },
  // Styles for the Modal (to be added in the next step)
  modalContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)' // Semi-transparent background
  },
  modalContent: {
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors[colorScheme].border,
  },
  modalItemText: {
    fontSize: 16,
    color: Colors[colorScheme].text,
  },
  modalCloseButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: Colors[colorScheme].tint,
    fontWeight: '600',
  },
});

export default AddExtraClassScreen;
