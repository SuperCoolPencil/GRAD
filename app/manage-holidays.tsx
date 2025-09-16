import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { View, TextInput, FlatList, StyleSheet, useColorScheme, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
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
  startDate: string;
  endDate: string; 
}

export default function ManageHolidaysScreen() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [saving, setSaving] = useState(false); // used for Add button and bulk ops
  const didPromptPrevDay = useRef(false); // To ensure prompt runs only once
  const colorScheme = (useColorScheme() as 'light' | 'dark') || 'light';
  const { refreshKey, setRefreshKey } = useContext(AppContext);
  const { colors } = useTheme();
  const { showAlert } = useCustomAlert();

  const styles = useMemo(() => getStyles(colorScheme, colors), [colorScheme, colors]);

  useEffect(() => {
    loadHolidays();
    if (!didPromptPrevDay.current) {
      checkPreviousDayAndPrompt();
      didPromptPrevDay.current = true;
    }
  }, [refreshKey]);

  const getLocalIso = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const toDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const previousDayIso = getLocalIso(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const checkPreviousDayAndPrompt = async () => {
    try {
      const attendanceRecords = await getAttendanceRecordsForCourseInRange('', previousDayIso, previousDayIso);
      const nonCancelled = attendanceRecords.filter((r: AttendanceRecord) => r.status !== 'cancelled');
      if (nonCancelled.length === 0) return;
      showAlert(
        'Confirm',
        `Mark all classes on ${previousDayIso} as cancelled and add a holiday for that day?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            onPress: async () => {
              setSaving(true);
              try {
                const courseCounts: { [courseId: string]: { presents: number; absents: number; cancelled: number } } = {};
                const toUpdateIds: string[] = [];
                for (const r of nonCancelled) {
                  toUpdateIds.push(r.id);
                  if (!courseCounts[r.course_id]) courseCounts[r.course_id] = { presents: 0, absents: 0, cancelled: 0 };
                  if (r.status === 'present') courseCounts[r.course_id].presents--;
                  else if (r.status === 'absent') courseCounts[r.course_id].absents--;
                  courseCounts[r.course_id].cancelled++;
                }
                await Promise.all(nonCancelled.map((r) => updateAttendanceRecord(r.id, 'cancelled')));
                await bulkUpdateCourseCounts(courseCounts);
                const holidayId = uuidv4();
                await addHoliday(holidayId, `Auto-cancel ${previousDayIso}`, previousDayIso, previousDayIso);
                setRefreshKey(prev => prev + 1);
                showAlert('Success', `Marked ${nonCancelled.length} records cancelled and added holiday for ${previousDayIso}.`);
              } catch (err) {
                console.error('Failed to bulk-cancel previous day:', err);
                showAlert('Error', 'Failed to cancel previous day classes. Try again.');
              } finally {
                setSaving(false);
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error('Failed checking previous day attendance:', err);
    }
  };

  const loadHolidays = async () => {
    try {
      const res = getHolidays();
      const holidaysFromDb = res instanceof Promise ? await res : res;
      const allHolidays: Holiday[] = Array.isArray(holidaysFromDb) ? holidaysFromDb : [];
      const today = getLocalIso(new Date());
      const upcoming = allHolidays.filter(holiday => holiday.endDate >= today);
      setHolidays(upcoming);
      // setPastHolidays([]); // Past holidays list is removed
    } catch (error) {
      console.error('Failed loading holidays', error);
      setHolidays([]);
      // setPastHolidays([]);
    }
  };

  const formatDate = (date: Date) => { // This function is still used by onStartDateChange/onEndDateChange
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
      showAlert('Invalid', 'Holiday name is required', [{ text: 'OK', style: 'cancel' }]);
      return;
    }
    if (!isValidDate(trimmedStartDate) || !isValidDate(trimmedEndDate)) {
      showAlert('Invalid', 'Start and End Dates must be in YYYY-MM-DD format', [{ text: 'OK', style: 'cancel' }]);
      return;
    }
    if (trimmedStartDate > trimmedEndDate) {
      showAlert('Invalid', 'Start Date cannot be after End Date', [{ text: 'OK', style: 'cancel' }]);
      return;
    }

    setSaving(true);
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
      console.error('Failed adding holiday', error);
      showAlert('Error', 'Could not add holiday');
      await loadHolidays();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const res = deleteHoliday(id);
      if ((res as any) instanceof Promise) await res;
      setRefreshKey((prev: number) => prev + 1); // Trigger refresh
    } catch (error) {
      console.error('Failed deleting holiday', error);
      showAlert('Error', 'Could not delete holiday');
      await loadHolidays();
    }
  };

  const renderHolidayItem = useCallback(({ item }: { item: Holiday }) => (
    <View style={styles.holidayItem} key={item.id}>
      <View style={styles.holidayTextContainer}>
        <ThemedText numberOfLines={1} style={styles.holidayName}>{item.name}</ThemedText>
        <ThemedText style={styles.holidayDate}>{item.startDate} to {item.endDate}</ThemedText>
      </View>
      <TouchableOpacity onPress={() => handleDeleteHoliday(item.id)} accessibilityLabel={`Delete ${item.name}`}>
        <Ionicons name="close-circle-outline" size={22} color={Colors[colorScheme].error} />
      </TouchableOpacity>
    </View>
  ), [styles, colorScheme]);

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
          <TouchableOpacity onPress={showStartDatepicker} style={styles.dateInputTouchable}>
            <ThemedText style={{ color: startDate ? Colors[colorScheme].text : Colors[colorScheme].text, textAlign: 'center' }}>
              {startDate || "Start Date (YYYY-MM-DD)"}
            </ThemedText>
          </TouchableOpacity>
          {showStartDatePicker && (
            <DateTimePicker
              testID="startDatePicker"
              value={startDate ? toDate(startDate) : new Date()}
              mode="date"
              display="default"
              onChange={onStartDateChange}
            />
          )}

          <TouchableOpacity onPress={showEndDatepicker} style={styles.dateInputTouchable}>
            <ThemedText style={{ color: endDate ? Colors[colorScheme].text : Colors[colorScheme].text, textAlign: 'center' }}>
              {endDate || "End Date (YYYY-MM-DD)"}
            </ThemedText>
          </TouchableOpacity>
          {showEndDatePicker && (
            <DateTimePicker
              testID="endDatePicker"
              value={endDate ? toDate(endDate) : new Date()}
              mode="date"
              display="default"
              onChange={onEndDateChange}
            />
          )}
          <TouchableOpacity
            style={[styles.primaryButton, saving && { opacity: 0.6 }]}
            onPress={handleAddHoliday}
            disabled={saving}
            accessibilityRole="button"
          >
            <ThemedText style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Add Holiday'}</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText style={styles.sectionTitle}>Upcoming Holidays</ThemedText>
        <FlatList
          data={holidays}
          renderItem={renderHolidayItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<ThemedText>No upcoming holidays</ThemedText>}
        />
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
    textAlign: 'center', // centers placeholder and typed text
  },
  dateInputTouchable: {
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999, // pill shape
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
