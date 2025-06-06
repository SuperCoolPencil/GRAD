import React, { useState, useContext, useMemo, useLayoutEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Platform,
  FlatList,
} from 'react-native';
import Slider from '@react-native-community/slider';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { ScheduleItem } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useCustomAlert } from '@/context/AlertContext'; // Import the custom alert hook

const AddCourseScreen = () => {
  const { addCourse, isValidCourseId } = useContext(AppContext);
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme() ?? 'light';
  const { showAlert } = useCustomAlert(); // Use the custom alert hook

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: `Add Course`,
      headerStyle: styles.headerStyle,
    });
  }, [navigation, colorScheme]);

  // Course details state
  const [courseName, setCourseName] = useState('');
  const [courseId, setCourseId] = useState('');

  // Attendance state
  const [requiredAttendance, setRequiredAttendance] = useState(75);

  // Weekly schedule state
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleItem[]>([]);

  // UI control state
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Generate styles based on theme
  const styles = useMemo(() => getStyles(colorScheme, Colors[colorScheme]), [colorScheme]);

  // Helper functions
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

  const validateScheduleItem = () => {
    if (selectedDays.length === 0) {
      showAlert("Error", "Please select a day.");
      return false;
    }

    if (!startTime) {
      showAlert("Error", "Please select a start time.");
      return false;
    }

    if (!endTime) {
      showAlert("Error", "Please select an end time.");
      return false;
    }

    if (startTime >= endTime) {
      showAlert("Error", "End time must be after start time.");
      return false;
    }

    // Check for overlapping schedule items
    const hasOverlap = weeklySchedule.some(item => {
      if (!selectedDays.includes(item.day)) return false;

      const itemStart = new Date(`2000-01-01T${item.timeStart}`);
      const itemEnd = new Date(`2000-01-01T${item.timeEnd}`);
      const newStart = new Date(`2000-01-01T${getTimeForStorage(startTime)}`);
      const newEnd = new Date(`2000-01-01T${getTimeForStorage(endTime)}`);

      return (
        (newStart >= itemStart && newStart < itemEnd) ||
        (newEnd > itemStart && newEnd <= itemEnd) ||
        (newStart <= itemStart && newEnd >= itemEnd)
      );
    });

    if (hasOverlap) {
      showAlert("Error", "This schedule overlaps with an existing class time.");
      return false;
    }

    return true;
  };

  const addWeeklyClass = () => {
    if (!validateScheduleItem()) return;

    const isTimeAfter5PM = endTime && endTime.getHours() >= 17;

    if (isTimeAfter5PM) {
      showAlert(
        "Confirmation",
        "This class ends after 5 PM. Are you sure you want to add it?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Confirm",
            onPress: () => {
              selectedDays.forEach(selectedDay => {
                const newScheduleItem = {
                  id: Date.now().toString(),
                  day: selectedDay || '', // Ensure day is a string
                  timeStart: startTime ? getTimeForStorage(startTime) : '',
                  timeEnd: endTime ? getTimeForStorage(endTime) : '',
                };
                setWeeklySchedule(prevSchedule => [...prevSchedule, newScheduleItem]);
              });

              setSelectedDays([]);
              setStartTime(null);
              setEndTime(null);
            },
          },
        ]
      );
    } else {
      selectedDays.forEach(selectedDay => {
        const newScheduleItem = {
          id: Date.now().toString(),
          day: selectedDay || '', // Ensure day is a string
          timeStart: startTime ? getTimeForStorage(startTime) : '',
          timeEnd: endTime ? getTimeForStorage(endTime) : '',
        };
        setWeeklySchedule(prevSchedule => [...prevSchedule, newScheduleItem]);
      });

      setSelectedDays([]);
      setStartTime(null);
      setEndTime(null);
    }
  };

  const removeScheduleItem = (id: string) => {
    setWeeklySchedule(weeklySchedule.filter(item => item.id !== id));
  };

  const handleSubmit = async () => {
    // Validate form
    if (!courseName.trim()) {
      showAlert("Error", "Please enter a course name.");
      return;
    }

    if (!courseId.trim()) {
      showAlert("Error", "Please enter a course ID.");
      return;
    }

    if (!isValidCourseId(courseId.trim())) {
      showAlert("Error", "Course ID must contain only numbers and alphabets.");
      return;
    }

    if (weeklySchedule.length === 0) {
      showAlert("Warning", "You haven't added any weekly classes. Continue anyway?", [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Continue",
          onPress: submitCourse
        }
      ]);
      return;
    }

    submitCourse();
  };

  const submitCourse = async () => {
    try {
      await addCourse({
        id: courseId.trim(),
        name: courseName.trim(),
        presents: 0,
        absents: 0,
        cancelled: 0,
        weeklySchedule: weeklySchedule,
        attendanceRecords: [],
        extraClasses: [],
        requiredAttendance: requiredAttendance,
      });

      showAlert("Success", "Course added successfully!", [
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
      console.error("Failed to add course:", error);
      showAlert("Error", "Failed to add course. Please try again.");
    }
  };

  const resetForm = () => {
    setCourseName("");
    setCourseId("");
    setWeeklySchedule([]);
    setSelectedDays([]);
    setStartTime(null);
    setEndTime(null);
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

  // Render schedule item
  const renderScheduleItem = ({ item }: { item: ScheduleItem }) => {
    // Convert stored 24-hour time strings to readable 12-hour format
    const startTime = new Date(`2000-01-01T${item.timeStart}`);
    const endTime = new Date(`2000-01-01T${item.timeEnd}`);

    return (
      <View style={styles.scheduleItem}>
        <View>
          <ThemedText style={styles.scheduleDay}>{item.day}</ThemedText>
          <ThemedText style={styles.scheduleTime}>
            {formatTime(startTime)} - {formatTime(endTime)}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => removeScheduleItem(item.id)}>
          <Ionicons
            name="close-circle-outline"
            size={20}
            color={Colors[colorScheme].tint}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const formData = {
    courseName,
    courseId,
    requiredAttendance,
    selectedDays,
    startTime,
    endTime,
    weeklySchedule,
    showStartTimePicker,
    showEndTimePicker,
    setCourseName,
    setCourseId,
    setRequiredAttendance,
    setSelectedDays,
    setStartTime,
    setEndTime,
    setWeeklySchedule,
    setShowStartTimePicker,
    setShowEndTimePicker,
    handleStartTimeChange,
    handleEndTimeChange,
    addWeeklyClass,
    removeScheduleItem,
    handleSubmit,
  };

  const toggleDaySelection = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(selectedDay => selectedDay !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  return (
    <FlatList
      data={[formData]}
      keyExtractor={() => 'form'}
      renderItem={({ item }) => (
        <ThemedView style={styles.contentContainer}>
          {/* Course Details Section */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Course Details</ThemedText>

            <ThemedText style={styles.label}>Course Name:</ThemedText>
            <TextInput
              style={styles.input}
              value={item.courseName}
              onChangeText={item.setCourseName}
              placeholder="Enter Course Name (e.g., Calculus)"
              placeholderTextColor={Colors[colorScheme].placeholder}
              autoCapitalize="sentences"
            />
            <ThemedText style={styles.label}>Course ID:</ThemedText>
            <TextInput
              style={styles.input}
              value={item.courseId}
              placeholder="Enter Course ID (e.g., MA102)"
              placeholderTextColor={Colors[colorScheme].placeholder}
              autoCapitalize="characters"
              onChangeText={(text) => {
                // Allow only alphanumeric characters
                const formattedText = text.replace(/[^a-zA-Z0-9]/g, '');
                item.setCourseId(formattedText);
              }}
            />

            <ThemedText style={styles.label}>Required Attendance: {item.requiredAttendance}%</ThemedText>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={item.requiredAttendance}
              onSlidingComplete={(value) => item.setRequiredAttendance(value)}
              minimumTrackTintColor={Colors[colorScheme].tint}
              maximumTrackTintColor={Colors[colorScheme].border}
              thumbTintColor={Colors[colorScheme].white}
            />

            <View style={{ height: 1, backgroundColor: Colors[colorScheme].border, marginVertical: 10 }} />
          </View>

          {/* Weekly Schedule Section */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Weekly Schedule</ThemedText>

            {/* Day selection */}
            <ThemedText style={styles.label}>Select Day:</ThemedText>
            <View style={styles.dayButtonContainer}>
              {['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'].map((day, index) => {
                const fullDayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index];
                const isSelected = selectedDays.includes(fullDayName);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected,
                      { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }
                    ]}
                    onPress={() => toggleDaySelection(fullDayName)}
                  >
                    <ThemedText style={[
                      styles.dayButtonText,
                      isSelected && styles.dayButtonTextSelected
                    ]}>
                      {day}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Time selection */}
            <View style={styles.timeContainer}>
              <View style={styles.timeSection}>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => item.setShowStartTimePicker(true)}
                >
                  <ThemedText style={styles.timePickerText}>
                    {item.startTime ? formatTime(item.startTime) : 'Select Start Time'}
                  </ThemedText>
                </TouchableOpacity>
                {item.showStartTimePicker && (
                  <DateTimePicker
                    value={item.startTime || new Date()}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={item.handleStartTimeChange}
                  />
                )}
              </View>

              <View style={styles.timeSection}>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => item.setShowEndTimePicker(true)}
                >
                  <ThemedText style={styles.timePickerText}>
                    {item.endTime ? formatTime(item.endTime) : 'Select End Time'}
                  </ThemedText>
                </TouchableOpacity>
                {item.showEndTimePicker && (
                  <DateTimePicker
                    value={item.endTime || new Date()}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={item.handleEndTimeChange}
                  />
                )}
              </View>
            </View>

            {/* Add class button */}
            <TouchableOpacity style={styles.secondaryButton} onPress={item.addWeeklyClass}>
              <ThemedText style={styles.secondaryButtonText}>
                Add Weekly Class
              </ThemedText>
            </TouchableOpacity>

            {/* Display current schedule */}
            {item.weeklySchedule.length > 0 && (
              <View style={styles.scheduleContainer}>
                <ThemedText style={styles.label}>Current Schedule:</ThemedText>
                <FlatList
                  data={item.weeklySchedule}
                  renderItem={renderScheduleItem}
                  keyExtractor={item => item.id}
                  style={styles.scheduleList}
                />
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.primaryButton} onPress={item.handleSubmit}>
            <ThemedText style={styles.primaryButtonText}>Save Course</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}
      style={styles.container}
    />
  );
};

// Function to generate theme-aware styles
const getStyles = (colorScheme: 'light' | 'dark', colors: any) => StyleSheet.create({
  headerStyle: {
    backgroundColor: colors.card,
  },
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: Colors[colorScheme].text,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: Colors[colorScheme].text,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors[colorScheme].inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    color: Colors[colorScheme].text,
    borderWidth: 1,
    borderColor: Colors[colorScheme].placeholder,
  },
  dayButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  dayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors[colorScheme].card,
    marginBottom: 8,
    minWidth: 45,
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: Colors[colorScheme].tint,
    borderColor: Colors[colorScheme].tint,
  },
  dayButtonText: {
    color: Colors[colorScheme].text,
    fontWeight: '500',
    textAlign: 'center',
    // Fix for iOS/Android text vertical alignment
    lineHeight: Platform.OS === 'ios' ? 40 : undefined, // Match the height of the button
    includeFontPadding: false, // For Android
  },
  dayButtonTextSelected: {
    color: colors.card,
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
    color: colors.buttonText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: Colors[colorScheme].card,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors[colorScheme].tint,
  },
  secondaryButtonText: {
    color: Colors[colorScheme].tint,
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleContainer: {
    marginTop: 20,
  },
  scheduleList: {
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors[colorScheme].card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderColor: Colors[colorScheme].border,
  },
  scheduleDay: {
    fontWeight: 'bold',
    fontSize: 16,
    color: Colors[colorScheme].text,
  },
  scheduleTime: {
    color: Colors[colorScheme].text,
    marginTop: 4,
  },
});

export default AddCourseScreen;
