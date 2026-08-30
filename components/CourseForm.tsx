import React, { useState, useContext, useMemo, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import Slider from '@react-native-community/slider';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { ThemedText } from '@/components/ThemedText';
import { ScheduleItem, Course } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useCustomAlert } from '@/context/AlertContext';
import { formatTime as formatTimeUtil } from '@/utils/time';

interface CourseFormProps {
  initialData?: Partial<Course>;
  onSubmit: (courseData: Course) => Promise<void>;
  isEditing: boolean;
  footer?: React.ReactNode;
}

const CourseForm: React.FC<CourseFormProps> = ({ initialData, onSubmit, isEditing, footer }) => {
  const { isValidCourseId, is24Hour } = useContext(AppContext);
  const colorScheme = useColorScheme() ?? 'light';
  const { showAlert } = useCustomAlert();

  const [courseName, setCourseName] = useState(initialData?.name || '');
  const [courseId, setCourseId] = useState(initialData?.id || '');
  const [requiredAttendance, setRequiredAttendance] = useState(initialData?.requiredAttendance || 75);
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleItem[]>(initialData?.weeklySchedule || []);

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    if (initialData) {
      setCourseName(initialData.name || '');
      setCourseId(initialData.id || '');
      setRequiredAttendance(initialData.requiredAttendance || 75);
      setWeeklySchedule(initialData.weeklySchedule || []);
    }
  }, [initialData]);

  const styles = useMemo(() => getStyles(colorScheme, Colors[colorScheme]), [colorScheme]);

  const formatTime = (date: Date) => {
    const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return formatTimeUtil(timeString, is24Hour);
  };

  const getTimeForStorage = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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
    const hasOverlap = weeklySchedule.some(item => {
      if (!selectedDays.includes(item.day)) return false;
      const itemStart = new Date(`2000-01-01T${item.timeStart}`);
      const itemEnd = new Date(`2000-01-01T${item.timeEnd}`);
      const newStart = new Date(`2000-01-01T${getTimeForStorage(startTime)}`);
      const newEnd = new Date(`2000-01-01T${getTimeForStorage(endTime)}`);
      return (newStart < itemEnd && newEnd > itemStart);
    });
    if (hasOverlap) {
      showAlert("Error", "This schedule overlaps with an existing class time.");
      return false;
    }
    return true;
  };

  const addWeeklyClass = () => {
    if (!validateScheduleItem()) return;
    const newScheduleItems = selectedDays.map(day => ({
      id: Date.now().toString() + Math.random(),
      day,
      timeStart: getTimeForStorage(startTime!),
      timeEnd: getTimeForStorage(endTime!),
    }));
    setWeeklySchedule([...weeklySchedule, ...newScheduleItems].sort((a, b) => {
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day) || a.timeStart.localeCompare(b.timeStart);
    }));
    setSelectedDays([]);
    setStartTime(null);
    setEndTime(null);
  };

  const removeScheduleItem = (id: string) => {
    setWeeklySchedule(weeklySchedule.filter(item => item.id !== id));
  };

  const handleSubmit = async () => {
    if (!courseName.trim()) {
      showAlert("Error", "Please enter a course name.");
      return;
    }
    if (!isEditing && !courseId.trim()) {
      showAlert("Error", "Please enter a course ID.");
      return;
    }
    if (!isEditing && !isValidCourseId(courseId.trim())) {
      showAlert("Error", "Course ID must contain only numbers and alphabets.");
      return;
    }

    const courseData: Course = {
      id: courseId.trim(),
      name: courseName.trim(),
      requiredAttendance,
      weeklySchedule: weeklySchedule.sort((a, b) => {
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day) || a.timeStart.localeCompare(b.timeStart);
      }),
      presents: initialData?.presents || 0,
      absents: initialData?.absents || 0,
      cancelled: initialData?.cancelled || 0,
      attendanceRecords: initialData?.attendanceRecords || [],
      extraClasses: initialData?.extraClasses || [],
      showInTracker: isEditing ? initialData?.showInTracker : true,
      showInHeatmap: isEditing ? initialData?.showInHeatmap : true,
      showInRadar: isEditing ? initialData?.showInRadar : true,
    };

    if (weeklySchedule.length === 0) {
      showAlert("Warning", "You haven't added any weekly classes. Continue anyway?", [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => onSubmit(courseData) }
      ]);
    } else {
      await onSubmit(courseData);
    }
  };

  const handleStartTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowStartTimePicker(false);
    if (selectedTime) setStartTime(selectedTime);
  };

  const handleEndTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowEndTimePicker(false);
    if (selectedTime) setEndTime(selectedTime);
  };

  const renderScheduleItem = ({ item }: { item: ScheduleItem }) => {
    const itemStartTime = new Date(`2000-01-01T${item.timeStart}`);
    const itemEndTime = new Date(`2000-01-01T${item.timeEnd}`);
    return (
      <View style={styles.scheduleItem}>
        <View>
          <ThemedText style={styles.scheduleDay}>{item.day}</ThemedText>
          <ThemedText style={styles.scheduleTime}>
            {formatTime(itemStartTime)} - {formatTime(itemEndTime)}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => removeScheduleItem(item.id)}>
          <Ionicons name="close-circle-outline" size={20} color={Colors[colorScheme].tint} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <FlatList
      data={weeklySchedule}
      renderItem={renderScheduleItem}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
      contentContainerStyle={styles.contentContainer}
      ListHeaderComponent={
        <>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Course Details</ThemedText>
            <ThemedText style={styles.label}>Course Name:</ThemedText>
            <TextInput
              style={styles.input}
              value={courseName}
              onChangeText={setCourseName}
              placeholder="Enter Course Name (e.g., Calculus)"
              placeholderTextColor={Colors[colorScheme].placeholder}
              autoCapitalize="sentences"
            />
            {!isEditing && (
              <>
                <ThemedText style={styles.label}>Course ID:</ThemedText>
                <TextInput
                  style={styles.input}
                  value={courseId}
                  placeholder="Enter Course ID (e.g., MA102)"
                  placeholderTextColor={Colors[colorScheme].placeholder}
                  autoCapitalize="characters"
                  onChangeText={(text) => setCourseId(text.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                />
              </>
            )}
            <ThemedText style={styles.label}>Required Attendance: {requiredAttendance}%</ThemedText>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={requiredAttendance}
              onSlidingComplete={setRequiredAttendance}
              minimumTrackTintColor={Colors[colorScheme].tint}
              maximumTrackTintColor={Colors[colorScheme].border}
              thumbTintColor={Colors[colorScheme].white}
            />
            <View style={{ height: 1, backgroundColor: Colors[colorScheme].border, marginVertical: 10 }} />
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Weekly Schedule</ThemedText>
            <ThemedText style={styles.label}>Select Day:</ThemedText>
            <View style={styles.dayButtonContainer}>
              {['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'].map((day, index) => {
                const fullDayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index];
                const isSelected = selectedDays.includes(fullDayName);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayButton, isSelected && styles.dayButtonSelected, { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }]}
                    onPress={() => {
                      setSelectedDays(isSelected ? selectedDays.filter(d => d !== fullDayName) : [...selectedDays, fullDayName]);
                    }}
                  >
                    <ThemedText style={[styles.dayButtonText, isSelected && styles.dayButtonTextSelected]}>{day}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.timeContainer}>
              <View style={styles.timeSection}>
                <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowStartTimePicker(true)}>
                  <ThemedText style={styles.timePickerText}>{startTime ? formatTime(startTime) : 'Select Start Time'}</ThemedText>
                </TouchableOpacity>
                {showStartTimePicker && <DateTimePicker value={startTime || new Date()} mode="time" is24Hour={is24Hour} display="default" onChange={handleStartTimeChange} />}
              </View>
              <View style={styles.timeSection}>
                <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowEndTimePicker(true)}>
                  <ThemedText style={styles.timePickerText}>{endTime ? formatTime(endTime) : 'Select End Time'}</ThemedText>
                </TouchableOpacity>
                {showEndTimePicker && <DateTimePicker value={endTime || new Date()} mode="time" is24Hour={is24Hour} display="default" onChange={handleEndTimeChange} />}
              </View>
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={addWeeklyClass}>
              <ThemedText style={styles.secondaryButtonText}>Add Weekly Class</ThemedText>
            </TouchableOpacity>

            {weeklySchedule.length > 0 && (
              <View style={styles.scheduleContainer}>
                <ThemedText style={styles.label}>Current Schedule:</ThemedText>
              </View>
            )}
          </View>
        </>
      }
      ListFooterComponent={
        <>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
            <ThemedText style={styles.primaryButtonText}>Save Course</ThemedText>
          </TouchableOpacity>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </>
      }
    />
  );
};

const getStyles = (colorScheme: 'light' | 'dark', colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    backgroundColor: colors.background,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
    color: Colors[colorScheme].textSecondary,
  },
  label: {
    fontSize: 15,
    marginBottom: 8,
    color: Colors[colorScheme].text,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors[colorScheme].inputBackground,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 14,
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
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors[colorScheme].card,
    marginBottom: 8,
    minWidth: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: Colors[colorScheme].tint,
  },
  dayButtonText: {
    color: Colors[colorScheme].text,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    includeFontPadding: false,
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
    height: 48,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerText: {
    color: Colors[colorScheme].text,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: Colors[colorScheme].tint,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: colors.buttonText,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
  },
  secondaryButton: {
    backgroundColor: Colors[colorScheme].card,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors[colorScheme].tint,
  },
  secondaryButtonText: {
    color: Colors[colorScheme].tint,
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleContainer: {
    marginTop: 20,
  },
  scheduleList: {},
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
    fontWeight: '600',
    fontSize: 15,
    color: Colors[colorScheme].text,
  },
  scheduleTime: {
    fontSize: 12,
    color: Colors[colorScheme].textSecondary,
    marginTop: 2,
  },
});

export default CourseForm;
