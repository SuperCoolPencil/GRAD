import React, { useState, useMemo } from 'react';
import { View, StyleSheet, useColorScheme, TouchableOpacity, ScrollView, FlatList, TextInput } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '../context/AppContext';
import { Holiday } from '../types';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import CustomHeader from '../components/CustomHeader';
import { formatDateToISO, parseISOToDate } from '../utils/dateHelpers';
import { useThemeColor } from '../hooks/useThemeColor';
import { Colors } from '../constants/Colors';
import { useTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useContext } from 'react';
import { useCustomAlert } from '../context/AlertContext';

const ManageHolidaysScreen = () => {
  const { holidays, addHoliday, deleteHoliday, upsertAttendance, courses, triggerRefresh } = useContext(AppContext);
  const { showAlert } = useCustomAlert();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colorScheme, colors), [colorScheme, colors]);

  const handleAddHoliday = () => {
    if (name.trim() === '') return;
    const newHoliday: Holiday = {
      id: Date.now().toString(),
      name,
      startDate: formatDateToISO(startDate),
      endDate: formatDateToISO(endDate),
    };
    addHoliday(newHoliday);
    setName('');

    showAlert(
      "Mark Attendance for Holiday",
      `How do you want to mark attendance for all classes during ${newHoliday.name}?`,
      [
        {
          text: "Mark as Cancelled",
          onPress: () => markHolidayAttendance(newHoliday, 'cancelled'),
        },
        {
          text: "Do Nothing",
          style: "cancel",
        },
      ]
    );
  };

  const markHolidayAttendance = (holiday: Holiday, status: 'cancelled') => {
    const startDate = parseISOToDate(holiday.startDate);
    const endDate = parseISOToDate(holiday.endDate);
    let currentDate = startDate;

    while (currentDate <= endDate) {
      const dateString = formatDateToISO(currentDate);
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][currentDate.getDay()];
      
      courses.forEach(course => {
        if (course.isArchived) return;

        course.weeklySchedule?.forEach(schedule => {
          if (schedule.day === dayName) {
            upsertAttendance(course.id, schedule.id, status, false, schedule.timeStart, schedule.timeEnd, dateString);
          }
        });

        course.extraClasses?.forEach(extraClass => {
          if (extraClass.date === dateString) {
            upsertAttendance(course.id, extraClass.id, status, true, extraClass.timeStart, extraClass.timeEnd, dateString);
          }
        });
      });

      currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
    }
    triggerRefresh();
  };

  const upcomingHolidays = holidays.filter((h: Holiday) => new Date(h.endDate) >= new Date());
  const pastHolidays = holidays.filter((h: Holiday) => new Date(h.endDate) < new Date());

  return (
    <ThemedView style={styles.container}>
      <CustomHeader title="Manage Holidays" />
      <ScrollView style={styles.contentContainer}>
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
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <ThemedText style={styles.timePickerText}>
                  {startDate.toLocaleDateString()}
                </ThemedText>
              </TouchableOpacity>
              {showStartDatePicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    const currentDate = selectedDate || startDate;
                    setShowStartDatePicker(false);
                    setStartDate(currentDate);
                  }}
                />
              )}
            </View>

            <View style={styles.timeSection}>
              <ThemedText style={styles.label}>End Date:</ThemedText>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <ThemedText style={styles.timePickerText}>
                  {endDate.toLocaleDateString()}
                </ThemedText>
              </TouchableOpacity>
              {showEndDatePicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    const currentDate = selectedDate || endDate;
                    setShowEndDatePicker(false);
                    setEndDate(currentDate);
                  }}
                />
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddHoliday}>
            <ThemedText style={styles.primaryButtonText}>Add Holiday</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Upcoming Holidays</ThemedText>
          <FlatList
            data={upcomingHolidays}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.holidayItem}>
                <View>
                  <ThemedText style={styles.holidayName}>{item.name}</ThemedText>
                  <ThemedText style={styles.holidayDate}>
                    {parseISOToDate(item.startDate).toLocaleDateString()} - {parseISOToDate(item.endDate).toLocaleDateString()}
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={() => deleteHoliday(item.id)}>
                  <Ionicons name="trash-bin" size={24} color={Colors[colorScheme].tint} />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Past Holidays</ThemedText>
          <FlatList
            data={pastHolidays}
            keyExtractor={item => item.id}
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
      </ScrollView>
    </ThemedView>
  );
};

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
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
