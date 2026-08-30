import React, { useContext, useState, useMemo, useEffect } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Modal, useColorScheme, FlatList } from 'react-native';
import { BlurView } from 'expo-blur';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCustomAlert } from '@/context/AlertContext';
import { RadarChart } from '@salmonco/react-native-radar-chart';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import { AppContext } from '@/context/AppContext';
import { Course, AttendanceRecord } from '@/types';
import { calculateAttendancePercentage, generateHeatmapData, getOldestRecordDate } from '@/utils/attendance';
import { useTheme } from '@react-navigation/native';
import HeatmapComponent from '@/components/Heatmap';
import { Colors } from '@/constants/Colors';
import AttendanceHistory from '@/components/AttendanceHistory';
import { CoursePicker } from '@/components/CoursePicker';

// Constants from HeatmapComponent to calculate layout
const CELL_SIZE = 20;
const CELL_MARGIN = 4;
const WEEKDAY_LABEL_WIDTH = 40; // Approx width for "Sun", "Mon", etc. labels

const formatDateForQuery = (date: Date): string => {
  return date.toISOString().slice(0, 10);
}

const formatMonthRange = (date: Date): string => {
  const startMonth = date.toLocaleString('default', { month: 'short' });
  const end = new Date(date);
  end.setMonth(end.getMonth() + 2);
  const endMonth = end.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear().toString().slice(-2);
  return `${startMonth} - ${endMonth} '${year}`;
}

export default function AnalyticsScreen() {
  const {
    courses,
    holidays, // Fetch holidays from AppContext
    getCoursesWithRecordsInRange,
    upsertAttendance,
    getPaginatedAttendanceRecords,
    attendanceRecords,
    totalRecords,
    loadData,
    deleteAttendanceRecord,
  } = useContext(AppContext);
  const activeCourses = useMemo(() => courses.filter(course => !course.isArchived), [courses]);
  const { showAlert, hideAlert } = useCustomAlert();
  const { colors } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const styles = useMemo(() => getStyles(colors, colorScheme), [colors, colorScheme]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);
  const [heatmapCourses, setHeatmapCourses] = useState<Course[]>([]);
  const [selectedHeatmapCourse, setSelectedHeatmapCourse] = useState<string[]>([]); // Changed to string[]
  const [displayMonth, setDisplayMonth] = useState(new Date(new Date().setMonth(new Date().getMonth() - 2)));
  const [page, setPage] = useState(1);
  const recordsPerPage = 10;

  useEffect(() => {
    getPaginatedAttendanceRecords(
      page,
      recordsPerPage,
      selectedCourses,
      fromDate ? formatDateForQuery(fromDate) : undefined,
      toDate ? formatDateForQuery(toDate) : undefined
    );
  }, [page, selectedCourses, fromDate, toDate]);

  const handleAttendanceClick = (record: AttendanceRecord) => {
    const course = courses.find(c => c.id === record.course_id);
    if (!record || !course) return;

    const recordDate = new Date(record.date);
    const formattedDate = recordDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    showAlert(
      'Change Attendance Status',
      `Change status for ${course.name} on ${formattedDate}.`,
      [
        {
          text: 'Present',
          onPress: () => {
            upsertAttendance(record.course_id, record.scheduleItemId || '', 'present', record.isExtraClass, record.timeStart, record.timeEnd, record.date);
            if (loadData) loadData();
            getPaginatedAttendanceRecords(
              page,
              recordsPerPage,
              selectedCourses,
              fromDate ? formatDateForQuery(fromDate) : undefined,
              toDate ? formatDateForQuery(toDate) : undefined
            );
          },
        },
        {
          text: 'Absent',
          onPress: () => {
            upsertAttendance(record.course_id, record.scheduleItemId || '', 'absent', record.isExtraClass, record.timeStart, record.timeEnd, record.date);
            if (loadData) loadData();
            getPaginatedAttendanceRecords(
              page,
              recordsPerPage,
              selectedCourses,
              fromDate ? formatDateForQuery(fromDate) : undefined,
              toDate ? formatDateForQuery(toDate) : undefined
            );
          },
        },
        {
          text: 'Cancelled',
          onPress: () => {
            upsertAttendance(record.course_id, record.scheduleItemId || '', 'cancelled', record.isExtraClass, record.timeStart, record.timeEnd, record.date);
            if (loadData) loadData();
            getPaginatedAttendanceRecords(
              page,
              recordsPerPage,
              selectedCourses,
              fromDate ? formatDateForQuery(fromDate) : undefined,
              toDate ? formatDateForQuery(toDate) : undefined
            );
          },
        },
        {
          text: 'Delete Record',
          style: 'destructive',
          shouldCloseAlert: false,
          onPress: async () => {
            console.log(`[Analytics] Deleting attendance record for ${course.name} on ${formattedDate}`);
            showAlert(
              'Confirm Delete',
              `Are you sure you want to delete this attendance record for ${course.name} on ${formattedDate}? This action cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel', onPress: hideAlert },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteAttendanceRecord(record.course_id, record.date, record.timeStart, record.timeEnd, record.isExtraClass);
                    if (loadData) loadData();
                    getPaginatedAttendanceRecords(
                      page,
                      recordsPerPage,
                      selectedCourses,
                      fromDate ? formatDateForQuery(fromDate) : undefined,
                      toDate ? formatDateForQuery(toDate) : undefined
                    );
                    hideAlert();
                  },
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: hideAlert },
      ]
    );
  };

  const chartData = activeCourses
    .filter(course => course.showInRadar !== false)
    .map(course => ({
      label: `${course.name}`,
      value: calculateAttendancePercentage(course.presents, course.absents),
    }));

  const oldestRecordDate = useMemo(() => getOldestRecordDate(courses), [courses]);

  useEffect(() => {
    const startDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const endDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 3, 0);

    getCoursesWithRecordsInRange(formatDateForQuery(startDate), formatDateForQuery(endDate))
      .then(setHeatmapCourses);
  }, [displayMonth, getCoursesWithRecordsInRange]);

  const heatmapData = useMemo(() => {
    const startDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const endDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 3, 0);
    let coursesToDisplay = selectedHeatmapCourse.length > 0
      ? heatmapCourses.filter(c => selectedHeatmapCourse.includes(c.id!))
      : heatmapCourses;
    coursesToDisplay = coursesToDisplay.filter(c => c.showInHeatmap);
    return generateHeatmapData(coursesToDisplay, holidays, startDate, endDate);
  }, [heatmapCourses, holidays, displayMonth, selectedHeatmapCourse]);

  const handlePrevPage = () => {
    setDisplayMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextPage = () => {
    setDisplayMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate: Date | undefined) => {
    const currentDate = selectedDate || (showDatePicker === 'from' ? fromDate : toDate);
    setShowDatePicker(null);
    if (currentDate) {
      if (showDatePicker === 'from') {
        setFromDate(currentDate);
        if (toDate && currentDate > toDate) {
          setToDate(null);
        }
      } else {
        setToDate(currentDate);
      }
    }
    setPage(1);
  };

  const ListHeader = React.memo(function ListHeader() {
    return (
    <>
      {activeCourses.length > 2 && (
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.sectionTitle} type="subtitle">Overall Attendance</ThemedText>
          <RadarChart
            data={chartData}
            maxValue={100}
            gradientColor={{ startColor: '#393939', endColor: '#393939', count: 5 }}
            stroke={['#666', '#666', '#666', '#666', '#666']}
            strokeWidth={[1, 1, 1, 1, 1]}
            strokeOpacity={[1, 1, 1, 1, 1]}
            labelColor={colors.text}
            dataFillColor={Colors[colorScheme].tint}
            dataFillOpacity={0.8}
            dataStroke={Colors[colorScheme].tint}
            dataStrokeWidth={2}
          />
        </ThemedView>
      )}
      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.heatmapHeader}>
          <TouchableOpacity onPress={handlePrevPage} disabled={oldestRecordDate ? displayMonth <= oldestRecordDate : true}>
            <Ionicons name="chevron-back" size={24} color={oldestRecordDate && displayMonth <= oldestRecordDate ? colors.border : colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.sectionTitle} type="subtitle">
            {formatMonthRange(displayMonth)}
          </ThemedText>
          <TouchableOpacity onPress={handleNextPage} disabled={displayMonth.getMonth() === new Date().getMonth() && displayMonth.getFullYear() === new Date().getFullYear()}>
            <Ionicons name="chevron-forward" size={24} color={displayMonth.getMonth() === new Date().getMonth() && displayMonth.getFullYear() === new Date().getFullYear() ? colors.border : colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <HeatmapComponent data={heatmapData} />
        </ScrollView>
        <CoursePicker
          label="Course:"
          courses={courses}
          selectedCourseIds={selectedHeatmapCourse}
          onSelectionChange={setSelectedHeatmapCourse}
          multiSelect={true}
          allCoursesOption={true}
          showArchivedToggle={true}
          showSaveButton={true}
        />
      </ThemedView>
      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText style={styles.sectionTitle} type="subtitle">Attendance History</ThemedText>
        <CoursePicker
          label="Course:"
          courses={courses}
          selectedCourseIds={selectedCourses}
          onSelectionChange={setSelectedCourses}
          multiSelect={true}
          allCoursesOption={true}
          showArchivedToggle={true}
          showSaveButton={true}
        />
        <View style={styles.inputGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <ThemedText style={styles.label}>From Date:</ThemedText>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker('from')}>
                <ThemedText style={styles.datePickerText}>{fromDate ? formatDate(fromDate) : 'Select Date'}</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <ThemedText style={styles.label}>To Date:</ThemedText>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker('to')}>
                <ThemedText style={styles.datePickerText}>{toDate ? formatDate(toDate) : 'Select Date'}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
          {showDatePicker && (
            <DateTimePicker value={showDatePicker === 'from' ? fromDate || new Date() : toDate || new Date()} mode="date" onChange={handleDateChange} />
          )}
          <TouchableOpacity style={styles.clearButton} onPress={() => {
            setFromDate(null);
            setToDate(null);
          }}>
            <ThemedText style={styles.clearButtonText}>Clear Dates</ThemedText>
          </TouchableOpacity>
        </View>
        <View />
      </ThemedView>
    </>
    );
  });

  const HistoryFilters = React.memo(function HistoryFilters() {
    return (
    <View>
      <CoursePicker
        label="Course:"
        courses={courses}
        selectedCourseIds={selectedCourses}
        onSelectionChange={setSelectedCourses}
        multiSelect={true}
        allCoursesOption={true}
        showArchivedToggle={true}
        showSaveButton={true}
      />
      <View style={styles.inputGroup}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <ThemedText style={styles.label}>From Date:</ThemedText>
            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker('from')}>
              <ThemedText style={styles.datePickerText}>{fromDate ? formatDate(fromDate) : 'Select Date'}</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <ThemedText style={styles.label}>To Date:</ThemedText>
            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker('to')}>
              <ThemedText style={styles.datePickerText}>{toDate ? formatDate(toDate) : 'Select Date'}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
        {showDatePicker && (
          <DateTimePicker value={showDatePicker === 'from' ? fromDate || new Date() : toDate || new Date()} mode="date" onChange={handleDateChange} />
        )}
        <TouchableOpacity style={styles.clearButton} onPress={() => {
          setFromDate(null);
          setToDate(null);
        }}>
          <ThemedText style={styles.clearButtonText}>Clear Dates</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Analytics</ThemedText>
      </ThemedView>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {chartData.length > 2 && (
          <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
            <ThemedText style={styles.sectionTitle} type="subtitle">Overall Attendance</ThemedText>
            <RadarChart
              data={chartData}
              maxValue={100}
              gradientColor={{ startColor: '#393939', endColor: '#393939', count: 5 }}
              stroke={['#666', '#666', '#666', '#666', '#666']}
              strokeWidth={[1, 1, 1, 1, 1]}
              strokeOpacity={[1, 1, 1, 1, 1]}
              labelColor={colors.text}
              dataFillColor={Colors[colorScheme].tint}
              dataFillOpacity={0.8}
              dataStroke={Colors[colorScheme].tint}
              dataStrokeWidth={2}
            />
          </ThemedView>
        )}

        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.heatmapHeader}>
            <TouchableOpacity onPress={handlePrevPage} disabled={oldestRecordDate ? displayMonth <= oldestRecordDate : true}>
              <Ionicons name="chevron-back" size={24} color={oldestRecordDate && displayMonth <= oldestRecordDate ? colors.border : colors.text} />
            </TouchableOpacity>
            <ThemedText style={styles.sectionTitle} type="subtitle">
              {formatMonthRange(displayMonth)}
            </ThemedText>
            <TouchableOpacity onPress={handleNextPage} disabled={displayMonth.getMonth() === new Date().getMonth() && displayMonth.getFullYear() === new Date().getFullYear()}>
              <Ionicons name="chevron-forward" size={24} color={displayMonth.getMonth() === new Date().getMonth() && displayMonth.getFullYear() === new Date().getFullYear() ? colors.border : colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HeatmapComponent data={heatmapData} />
          </ScrollView>
          <CoursePicker
            label="Course:"
            courses={courses}
            selectedCourseIds={selectedHeatmapCourse}
            onSelectionChange={setSelectedHeatmapCourse}
            multiSelect={true}
            allCoursesOption={true}
            showArchivedToggle={true}
            showSaveButton={true}
          />
        </ThemedView>

        <AttendanceHistory
          title="Attendance History"
          records={attendanceRecords}
          courses={courses}
          onRecordClick={handleAttendanceClick}
          ListHeaderComponent={<HistoryFilters />}
          currentPage={page}
          totalRecords={totalRecords}
          recordsPerPage={recordsPerPage}
          onPageChange={setPage}
        />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, colorScheme: 'light' | 'dark') => StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 64,
    backgroundColor: "transparent",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8, // Increased gap for breathing room
  },
  card: {
    borderRadius: 20, // Softer corners
    padding: 18,
  },
  sectionTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 2,
    paddingHorizontal: 8,
    backgroundColor: Colors[colorScheme].cardBackground,
    borderRadius: 12,
  },
  historyText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '500',
  },
  historyDateText: {
    marginLeft: 'auto',
    fontSize: 14,
    opacity: 0.8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
    color: colors.text,
  },
  input: {
    borderColor: colors.border,
    backgroundColor: Colors[colorScheme].inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    backgroundColor: Colors[colorScheme].inputBackground,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderColor: colors.border,
  },
  datePickerText: {
    color: colors.text,
    fontSize: 16,
  },
  pickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: colors.border,
    backgroundColor: Colors[colorScheme].inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    height: 50,
  },
  pickerTriggerText: {
    fontSize: 16,
    color: colors.text,
  },
  blurView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors[colorScheme].separator
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: 16,
    color: colors.text,
  },
  showMoreButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 5,
  },
  showMoreButtonText: {
    color: colors.text,
    fontWeight: 'bold',
  },
  showLessButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 5,
  },
  showLessButtonText: {
    color: colors.text,
    fontWeight: 'bold',
  },
  clearButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors[colorScheme].error,
    borderRadius: 5,
  },
  clearButtonText: {
    color: Colors[colorScheme].buttonText,
    fontWeight: 'bold',
  },
  doneButton: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors[colorScheme].success,
    borderRadius: 5,
  },
  doneButtonText: {
    color: Colors[colorScheme].buttonText,
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalCloseButton: {
    backgroundColor: Colors[colorScheme].tint,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseButtonText: {
    color: Colors[colorScheme].buttonText,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
