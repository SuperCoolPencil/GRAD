import React, { useCallback, useMemo, useState, useContext } from 'react';
import { View, StyleSheet, useColorScheme, TouchableOpacity, ScrollView, FlatList, TextInput, SafeAreaView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '../context/AppContext';
import { Holiday, SkipDay } from '../types';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import CustomHeader from '../components/CustomHeader';
import { formatDateToISO, parseISOToDate } from '../utils/dateHelpers';
import { Colors } from '../constants/Colors';
import { useTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomAlert } from '../context/AlertContext';
import { getSetting } from '../utils/database'; // Import getSetting

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ManageHolidaysScreen: React.FC = () => {
  const { holidays, addHoliday, deleteHoliday, skipDays, addSkipDay, deleteSkipDay, upsertAttendance, courses, triggerRefresh } = useContext(AppContext);
  const { showAlert } = useCustomAlert();
  const colorScheme = useColorScheme() ?? 'light';
  const { colors } = useTheme();

  const [name, setName] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(() => new Date());
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState<boolean>(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState<boolean>(false);

  // Skip day form state
  const [skipDate, setSkipDate] = useState<Date>(() => new Date());
  const [skipReason, setSkipReason] = useState<string>('');
  const [showSkipDatePicker, setShowSkipDatePicker] = useState<boolean>(false);

  const styles = useMemo(() => getStyles(colorScheme, colors), [colorScheme, colors]);

  const resetForm = useCallback(() => {
    setName('');
    setStartDate(new Date());
    setEndDate(new Date());
  }, []);

  const resetSkipDayForm = useCallback(() => {
    setSkipDate(new Date());
    setSkipReason('');
  }, []);

  const markHolidayAttendance = useCallback((holiday: Holiday, status: 'cancelled' | 'skipped') => {
    if (status === 'skipped') {
      console.log(`[HOLIDAY] Skipping marking attendance for holiday: ${holiday.name}`);
      triggerRefresh();
      return;
    }

    const start = parseISOToDate(holiday.startDate);
    const end = parseISOToDate(holiday.endDate);
    let current = new Date(start.getTime());

    while (current <= end) {
      const dateString = formatDateToISO(current);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][current.getDay()];

      courses.forEach(course => {
        if (course.isArchived) return;

        course.weeklySchedule?.forEach(schedule => {
          if (schedule.day === dayName) {
            upsertAttendance(course.id, schedule.id, 'cancelled', false, schedule.timeStart, schedule.timeEnd, dateString);
          }
        });

        course.extraClasses?.forEach(extraClass => {
          if (extraClass.date === dateString) {
            upsertAttendance(course.id, extraClass.id, 'cancelled', true, extraClass.timeStart, extraClass.timeEnd, dateString);
          }
        });
      });

      current = new Date(current.getTime() + MS_PER_DAY);
    }

    triggerRefresh();
  }, [courses, upsertAttendance, triggerRefresh]);

  const handleAddHoliday = useCallback(() => {
    if (name.trim() === '') {
      showAlert('Error', 'Holiday name cannot be empty.');
      return;
    }

    if (endDate < startDate) {
      showAlert('Error', 'End date cannot be before start date.');
      return;
    }

    const newHoliday: Holiday = {
      id: Date.now().toString(),
      name: name.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '),
      startDate: formatDateToISO(startDate),
      endDate: formatDateToISO(endDate),
    };

    const todayISO = new Date().toISOString().split('T')[0];
    const holidayBehaviorSetting = (getSetting('holidayBehavior') as string) || 'skip';

    let actionStatus: 'cancelled' | 'skipped';
    let actionText: string;
    let message: string;

    if (newHoliday.startDate <= todayISO) {
      // If the holiday starts in the past, always mark as cancelled for consistency
      actionStatus = 'cancelled';
      actionText = 'Mark as Cancelled';
      message = `The holiday starts in the past. Do you want to mark ${newHoliday.startDate} to ${newHoliday.endDate} as holiday? All classes will be marked as \"Cancelled\".`;
    } else {
      // If the holiday starts in the future, respect the user's setting
      actionStatus = holidayBehaviorSetting as 'cancelled' | 'skipped';
      actionText = holidayBehaviorSetting === 'skip' ? 'Skip Marking' : 'Mark as Cancelled';
      message = holidayBehaviorSetting === 'skip'
        ? `Do you want to skip marking classes for ${newHoliday.startDate} to ${newHoliday.endDate}? No attendance records will be created for this period.`
        : `Do you want to mark ${newHoliday.startDate} to ${newHoliday.endDate} as holiday? All classes will be marked as \"Cancelled\".`;
    }

    showAlert(
      'Mark Holiday?',
      message,
      [
        {
          text: actionText,
          onPress: () => {
            addHoliday(newHoliday);
            markHolidayAttendance(newHoliday, actionStatus);
            resetForm();
          }
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [name, startDate, endDate, addHoliday, resetForm, showAlert, markHolidayAttendance]);

  const handleAddSkipDay = useCallback(() => {
    const skipDateISO = formatDateToISO(skipDate);
    const todayISO = formatDateToISO(new Date());

    if (skipDateISO < todayISO) {
      showAlert('Error', 'Skip date cannot be in the past.');
      return;
    }

    // Check if skip day already exists for this date
    if (skipDays.some(s => s.date === skipDateISO)) {
      showAlert('Error', 'A skip day already exists for this date.');
      return;
    }

    const newSkipDay: SkipDay = {
      id: Date.now().toString(),
      date: skipDateISO,
      reason: skipReason.trim() || undefined,
    };

    addSkipDay(newSkipDay);
    resetSkipDayForm();
  }, [skipDate, skipReason, skipDays, addSkipDay, resetSkipDayForm, showAlert]);

  const upcomingHolidays = holidays.filter((h: Holiday) => new Date(h.endDate) >= new Date());
  const pastHolidays = holidays.filter((h: Holiday) => new Date(h.endDate) < new Date());
  const upcomingSkipDays = skipDays.filter((s: SkipDay) => new Date(s.date) >= new Date());
  const pastSkipDays = skipDays.filter((s: SkipDay) => new Date(s.date) < new Date());

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <CustomHeader title="Manage Holidays" />
        <ScrollView style={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <ThemedText style={styles.label}>Holiday Name:</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. Summer Break"
              value={name}
              onChangeText={setName}
              placeholderTextColor={Colors[colorScheme].text}
            />

            <View style={styles.timeContainer}>
              <View style={styles.timeSection}>
                <ThemedText style={styles.label}>Start Date:</ThemedText>
                <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowStartDatePicker(true)}>
                  <ThemedText style={styles.timePickerText}>{startDate.toLocaleDateString()}</ThemedText>
                </TouchableOpacity>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowStartDatePicker(false);
                      if (selectedDate) setStartDate(selectedDate);
                    }}
                  />
                )}
              </View>

              <View style={styles.timeSection}>
                <ThemedText style={styles.label}>End Date:</ThemedText>
                <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowEndDatePicker(true)}>
                  <ThemedText style={styles.timePickerText}>{endDate.toLocaleDateString()}</ThemedText>
                </TouchableOpacity>
                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowEndDatePicker(false);
                      if (selectedDate) setEndDate(selectedDate);
                    }}
                  />
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleAddHoliday}>
              <ThemedText
                style={styles.primaryButtonText}
                numberOfLines={1}
                ellipsizeMode="tail"
                allowFontScaling={false}
              >
                Add Holiday
              </ThemedText>
            </TouchableOpacity>

          </View>

          {upcomingHolidays.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Upcoming Holidays</ThemedText>
              <FlatList
                data={upcomingHolidays}
                keyExtractor={(item) => item.id}
                nestedScrollEnabled
                renderItem={({ item }) => (
                  <View style={styles.holidayItem}>
                    <View>
                      <ThemedText style={styles.holidayName}>{item.name}</ThemedText>
                      <ThemedText style={styles.holidayDate}>
                        {parseISOToDate(item.startDate).toLocaleDateString()} - {parseISOToDate(item.endDate).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => deleteHoliday(item.id)}>
                      <Ionicons name="close-circle" size={24} color={Colors[colorScheme].error} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          )}

          {pastHolidays.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Past Holidays</ThemedText>
              <FlatList
                data={pastHolidays}
                keyExtractor={(item) => item.id}
                nestedScrollEnabled
                renderItem={({ item }) => (
                  <View style={styles.holidayItem}>
                    <View>
                      <ThemedText style={styles.holidayName}>{item.name}</ThemedText>
                      <ThemedText style={styles.holidayDate}>
                        {parseISOToDate(item.startDate).toLocaleDateString()} - {parseISOToDate(item.endDate).toLocaleDateString()}
                      </ThemedText>
                    </View>
                  </View>
                )}
              />
            </View>
          )}

          {/* Skip Days Section */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Skip Days</ThemedText>
            <ThemedText style={[styles.label, { marginBottom: 12, opacity: 0.7 }]}>
              Mark specific days you plan to be absent. These will be considered when calculating your target attendance date.
            </ThemedText>

            <View style={styles.timeContainer}>
              <View style={[styles.timeSection, { flex: 2 }]}>
                <ThemedText style={styles.label}>Date:</ThemedText>
                <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowSkipDatePicker(true)}>
                  <ThemedText style={styles.timePickerText}>{skipDate.toLocaleDateString()}</ThemedText>
                </TouchableOpacity>
                {showSkipDatePicker && (
                  <DateTimePicker
                    value={skipDate}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowSkipDatePicker(false);
                      if (selectedDate) setSkipDate(selectedDate);
                    }}
                  />
                )}
              </View>
            </View>

            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Reason (optional)"
              value={skipReason}
              onChangeText={setSkipReason}
              placeholderTextColor={Colors[colorScheme].text}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleAddSkipDay}>
              <ThemedText
                style={styles.primaryButtonText}
                numberOfLines={1}
                ellipsizeMode="tail"
                allowFontScaling={false}
              >
                Add Skip Day
              </ThemedText>
            </TouchableOpacity>
          </View>

          {upcomingSkipDays.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Upcoming Skip Days</ThemedText>
              <FlatList
                data={upcomingSkipDays}
                keyExtractor={(item) => item.id}
                nestedScrollEnabled
                renderItem={({ item }) => (
                  <View style={styles.holidayItem}>
                    <View>
                      <ThemedText style={styles.holidayName}>
                        {parseISOToDate(item.date).toLocaleDateString()}
                      </ThemedText>
                      {item.reason && (
                        <ThemedText style={styles.holidayDate}>{item.reason}</ThemedText>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => deleteSkipDay(item.id)}>
                      <Ionicons name="close-circle" size={24} color={Colors[colorScheme].error} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          )}

          {pastSkipDays.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Past Skip Days</ThemedText>
              <FlatList
                data={pastSkipDays}
                keyExtractor={(item) => item.id}
                nestedScrollEnabled
                renderItem={({ item }) => (
                  <View style={styles.holidayItem}>
                    <View>
                      <ThemedText style={styles.holidayName}>
                        {parseISOToDate(item.date).toLocaleDateString()}
                      </ThemedText>
                      {item.reason && (
                        <ThemedText style={styles.holidayDate}>{item.reason}</ThemedText>
                      )}
                    </View>
                  </View>
                )}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark', colors: any) =>
  StyleSheet.create({
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
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 10,
      color: Colors[colorScheme].text,
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
      marginBottom: 20,
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
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
      minHeight: 48,
    },

    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      lineHeight: 22,           // helps center the text vertically
      // android-only (useful if you set a fixed height)
      textAlignVertical: 'center',
    },

    holidayItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 15,
      backgroundColor: Colors[colorScheme].card,
      borderRadius: 10,
      marginBottom: 10,
    },
    holidayName: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    holidayDate: {
      fontSize: 14,
      color: Colors[colorScheme].text,
    },
  });

export default ManageHolidaysScreen;
