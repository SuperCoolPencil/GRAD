import React, { useState, useEffect, useContext, useMemo } from 'react';
import { View, TextInput, FlatList, StyleSheet, useColorScheme, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { AppContext } from '@/context/AppContext';
import { addHoliday, deleteHoliday, getHolidays, getAttendanceRecordsForCourseInRange, updateAttendanceRecord, bulkUpdateCourseCounts } from '@/utils/database';
import Ionicons from '@expo/vector-icons/Ionicons';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import CustomHeader from '@/components/CustomHeader';
import { useTheme } from '@react-navigation/native';
import { useCustomAlert } from '@/context/AlertContext';
import { AttendanceRecord } from '@/types';

interface Holiday {
  id: string;
  name: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;   // ISO YYYY-MM-DD
}

export default function ManageHolidaysScreen() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [pastHolidays, setPastHolidays] = useState<Holiday[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const colorScheme = (useColorScheme() as 'light' | 'dark') || 'light';
  const { refreshKey, setRefreshKey } = useContext(AppContext);
  const { colors } = useTheme();
  const { showAlert } = useCustomAlert();

  const styles = useMemo(() => getStyles(colorScheme, colors), [colorScheme, colors]);

  useEffect(() => {
    loadHolidays();
  }, [refreshKey]);

  const loadHolidays = async () => {
    try {
      const res = getHolidays();
      const holidaysFromDb = res instanceof Promise ? await res : res;
      const allHolidays = Array.isArray(holidaysFromDb) ? holidaysFromDb : [];
      const today = formatDate(new Date());
      const upcoming = allHolidays.filter(holiday => holiday.endDate >= today);
      const past = allHolidays.filter(holiday => holiday.endDate < today);
      setHolidays(upcoming);
      setPastHolidays(past);
    } catch (error) {
      // keep failure silent but logged
      // eslint-disable-next-line no-console
      console.error('Failed loading holidays', error);
      setHolidays([]);
      setPastHolidays([]);
    }
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || new Date();
    setShowStartDatePicker(Platform.OS === 'ios');
    setStartDate(formatDate(currentDate));
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || new Date();
    setShowEndDatePicker(Platform.OS === 'ios');
    setEndDate(formatDate(currentDate));
  };

  const showStartDatepicker = () => {
    setShowStartDatePicker(true);
  };

  const showEndDatepicker = () => {
    setShowEndDatePicker(true);
  };

  const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

  const handleAddHoliday = async () => {
    const trimmedName = name.trim();
    const trimmedStartDate = startDate.trim();
    const trimmedEndDate = endDate.trim();

    if (!trimmedName) {
      Alert.alert('Invalid', 'Holiday name is required');
      return;
    }
    if (!isValidDate(trimmedStartDate) || !isValidDate(trimmedEndDate)) {
      Alert.alert('Invalid', 'Start and End Dates must be in YYYY-MM-DD format');
      return;
    }
    if (trimmedStartDate > trimmedEndDate) {
      Alert.alert('Invalid', 'Start Date cannot be after End Date');
      return;
    }

    const newHoliday: Holiday = { id: uuidv4(), name: trimmedName, startDate: trimmedStartDate, endDate: trimmedEndDate };

    try {
      const res = addHoliday(newHoliday.id, newHoliday.name, newHoliday.startDate, newHoliday.endDate);
      if ((res as any) instanceof Promise) await res;
      // optimistic UI update
      setHolidays((prev) => [newHoliday, ...prev]);
      setName('');
      setStartDate('');
      setEndDate('');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed adding holiday', error);
      Alert.alert('Error', 'Could not add holiday');
      await loadHolidays();
    }
  };

  const handlePastHoliday = async (holiday: Holiday) => {
    showAlert(
      "Confirm Cancellation",
      `Are you sure you want to mark all attendance records for ${holiday.name} (${holiday.startDate} to ${holiday.endDate}) as cancelled? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const attendanceRecords = getAttendanceRecordsForCourseInRange(
                '', // Empty string for all courses
                holiday.startDate,
                holiday.endDate
              );

              const courseCounts: { [courseId: string]: { presents: number, absents: number, cancelled: number } } = {};

              for (const record of attendanceRecords) {
                if (record.status !== 'cancelled') {
                  await updateAttendanceRecord(record.id, 'cancelled');
                  if (!courseCounts[record.course_id]) {
                    courseCounts[record.course_id] = { presents: 0, absents: 0, cancelled: 0 };
                  }
                  if (record.status === 'present') {
                    courseCounts[record.course_id].presents--;
                  } else if (record.status === 'absent') {
                    courseCounts[record.course_id].absents--;
                  }
                  courseCounts[record.course_id].cancelled++;
                }
              }
              await bulkUpdateCourseCounts(courseCounts);
              await deleteHoliday(holiday.id);
              setRefreshKey(prev => prev + 1); // Trigger refresh
              showAlert("Success", `All attendance records for ${holiday.name} have been marked as cancelled.`);
            } catch (error) {
              console.error('Failed to handle past holiday:', error);
              showAlert("Error", "Failed to mark attendance records as cancelled. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const res = deleteHoliday(id);
      if ((res as any) instanceof Promise) await res;
      setRefreshKey((prev: number) => prev + 1); // Trigger refresh
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed deleting holiday', error);
      Alert.alert('Error', 'Could not delete holiday');
      await loadHolidays();
    }
  };

  const renderHolidayItem = ({ item }: { item: Holiday }, isPast: boolean) => (
    <View style={styles.holidayItem} key={item.id}>
      <View style={styles.holidayTextContainer}>
        <ThemedText numberOfLines={1} style={styles.holidayName}>{item.name}</ThemedText>
        <ThemedText style={styles.holidayDate}>{item.startDate} to {item.endDate}</ThemedText>
      </View>
      {isPast ? (
        <TouchableOpacity onPress={() => handlePastHoliday(item)} accessibilityLabel={`Handle past holiday ${item.name}`}>
          <ThemedText style={styles.handlePastButtonText}>Mark as Cancelled</ThemedText>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => handleDeleteHoliday(item.id)} accessibilityLabel={`Delete ${item.name}`}>
          <Ionicons name="close-circle-outline" size={22} color={Colors[colorScheme].error} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <CustomHeader title="Manage Holidays" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.contentContainer}>
        <View style={styles.inputGroup}>
          <ThemedText style={styles.sectionTitle}>Add New Holiday</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Holiday Name"
            placeholderTextColor={Colors[colorScheme].text}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={showStartDatepicker} style={styles.input}>
            <ThemedText style={{ color: startDate ? Colors[colorScheme].text : Colors[colorScheme].text }}>
              {startDate || "Start Date (YYYY-MM-DD)"}
            </ThemedText>
          </TouchableOpacity>
          {showStartDatePicker && (
            <DateTimePicker
              testID="startDatePicker"
              value={startDate ? new Date(startDate) : new Date()}
              mode="date"
              display="default"
              onChange={onStartDateChange}
            />
          )}

          <TouchableOpacity onPress={showEndDatepicker} style={styles.input}>
            <ThemedText style={{ color: endDate ? Colors[colorScheme].text : Colors[colorScheme].text }}>
              {endDate || "End Date (YYYY-MM-DD)"}
            </ThemedText>
          </TouchableOpacity>
          {showEndDatePicker && (
            <DateTimePicker
              testID="endDatePicker"
              value={endDate ? new Date(endDate) : new Date()}
              mode="date"
              display="default"
              onChange={onEndDateChange}
            />
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddHoliday} accessibilityRole="button">
            <ThemedText style={styles.primaryButtonText}>Add Holiday</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText style={styles.sectionTitle}>Upcoming Holidays</ThemedText>
        <FlatList
          data={holidays}
          renderItem={(item) => renderHolidayItem(item, false)}
          keyExtractor={(item) => item.id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
        />

        {pastHolidays.length > 0 && (
          <>
            <ThemedText style={styles.sectionTitle}>Past Holidays</ThemedText>
            <FlatList
              data={pastHolidays}
              renderItem={(item) => renderHolidayItem(item, true)}
              keyExtractor={(item) => item.id}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
            />
          </>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const getStyles = (colorScheme: 'light' | 'dark', colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  inputContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 10,
    color: Colors[colorScheme].text,
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors[colorScheme].text,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  holidayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: Colors[colorScheme].card,
  },
  holidayTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  holidayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors[colorScheme].text,
  },
  holidayDate: {
    fontSize: 14,
    color: Colors[colorScheme].text,
    opacity: 0.8,
  },
  handlePastButtonText: {
    color: Colors[colorScheme].tint,
    fontSize: 14,
    fontWeight: '600',
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
