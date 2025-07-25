import React, { useContext, useState, useMemo, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Dimensions, FlatList, Text, TouchableOpacity, Modal, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCustomAlert } from '@/context/AlertContext';
import { RadarChart } from '@salmonco/react-native-radar-chart';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import { AppContext } from '@/context/AppContext';
import { Course } from '@/types';
import { calculateAttendancePercentage, generateHeatmapData, getOldestRecordDate } from '@/utils/attendance';
import { useTheme } from '@react-navigation/native';
import HeatmapComponent from '@/components/Heatmap';
import { Colors } from '@/constants/Colors';

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
  const { courses, getCoursesWithRecordsInRange, changeAttendanceRecord } = useContext(AppContext);
  const activeCourses = useMemo(() => courses.filter(course => !course.isArchived), [courses]);
  const { showAlert } = useCustomAlert();
  const { colors } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const styles = useMemo(() => getStyles(colors, colorScheme), [colors, colorScheme]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isHeatmapPickerVisible, setIsHeatmapPickerVisible] = useState(false);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(10);
  const [heatmapCourses, setHeatmapCourses] = useState<Course[]>([]);
  const [selectedHeatmapCourse, setSelectedHeatmapCourse] = useState<string | null>(null);

  // State for heatmap pagination
  const [displayMonth, setDisplayMonth] = useState(new Date());

  const handleAttendanceClick = (courseId: string, recordId: string) => {
    const course = courses.find(c => c.id === courseId);
    const record = course?.attendanceRecords?.find(r => r.id === recordId);
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
          onPress: () => changeAttendanceRecord(courseId, recordId, 'present'),
        },
        {
          text: 'Absent',
          onPress: () => changeAttendanceRecord(courseId, recordId, 'absent'),
        },
        {
          text: 'Cancelled',
          onPress: () =>
            changeAttendanceRecord(courseId, recordId, 'cancelled'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const chartData = activeCourses.map(course => ({
    label: course.name,
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
    const coursesToDisplay = selectedHeatmapCourse ? heatmapCourses.filter(c => c.id === selectedHeatmapCourse) : heatmapCourses;
    return generateHeatmapData(coursesToDisplay, startDate, endDate);
  }, [heatmapCourses, displayMonth, selectedHeatmapCourse]);

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
  };

  const filteredHistory = activeCourses.flatMap(course =>
    (course.attendanceRecords || []).map(record => ({ ...record, courseName: course.name, courseId: course.id }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
   .filter(record => {
    const courseMatch = selectedCourses.length > 0 ? selectedCourses.includes(record.courseId) : true;
    const recordDate = new Date(record.date);
    
    if (fromDate && recordDate < fromDate) {
      return false;
    }
    if (toDate) {
      const toDateEnd = new Date(toDate);
      toDateEnd.setHours(23, 59, 59, 999);
      if (recordDate > toDateEnd) {
        return false;
      }
    }

    return courseMatch;
  });

  const paginatedHistory = filteredHistory.slice(0, visibleHistoryCount);

  const CourseItem = React.memo(({ item, isSelected, onPress, colors, styles }: any) => (
    <TouchableOpacity
      style={styles.modalItem}
      onPress={onPress}
    >
      <Ionicons
        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={isSelected ? Colors[colorScheme].tint : colors.text}
        style={{ marginRight: 10 }}
      />
      <ThemedText style={styles.modalItemText}>{item.name}</ThemedText>
    </TouchableOpacity>
  ));

  const ListHeader = React.memo(() => (
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
            dataFillColor="#007AFF"
            dataFillOpacity={0.8}
            dataStroke="#007AFF"
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
        <HeatmapComponent data={heatmapData} />
        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Course:</ThemedText>
          <TouchableOpacity style={styles.pickerTrigger} onPress={() => setIsHeatmapPickerVisible(true)}>
            <ThemedText style={styles.pickerTriggerText}>
              {selectedHeatmapCourse ? courses.find(c => c.id === selectedHeatmapCourse)?.name ?? 'Select a course...' : 'All Courses'}
            </ThemedText>
            <Ionicons name="chevron-down" size={20} color={colors.text} />
          </TouchableOpacity>
          <Modal
            transparent={true}
            visible={isHeatmapPickerVisible}
            animationType="fade"
            onRequestClose={() => setIsHeatmapPickerVisible(false)}
          >
            <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPressOut={() => setIsHeatmapPickerVisible(false)}>
              <View style={styles.modalContent}>
                <FlatList
                  data={[{ id: null, name: 'All Courses' }, ...courses]}
                  keyExtractor={(item) => item.id || 'all-courses'}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.modalItem} onPress={() => {
                      setSelectedHeatmapCourse(item.id);
                      setIsHeatmapPickerVisible(false);
                    }}>
                      <ThemedText style={styles.modalItemText}>{item.name}</ThemedText>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      </ThemedView>
      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <ThemedText style={styles.sectionTitle} type="subtitle">Attendance History</ThemedText>
        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Course:</ThemedText>
          <TouchableOpacity style={styles.pickerTrigger} onPress={() => setIsPickerVisible(true)}>
            <ThemedText style={styles.pickerTriggerText}>
              {selectedCourses.length === 0 ? 'All Courses' : `${selectedCourses.length} course(s) selected`}
            </ThemedText>
            <Ionicons name="chevron-down" size={20} color={colors.text} />
          </TouchableOpacity>
          <Modal
            transparent={true}
            visible={isPickerVisible}
            animationType="fade"
            onRequestClose={() => setIsPickerVisible(false)}
          >
            <BlurView intensity={25} style={styles.blurView} tint="dark">
              <TouchableOpacity
                style={styles.modalContainer}
                activeOpacity={1}
                onPressOut={() => setIsPickerVisible(false)}
              >
                <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => setSelectedCourses([])}
                  >
                    <Ionicons
                      name={selectedCourses.length === 0 ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selectedCourses.length === 0 ? Colors[colorScheme].tint : colors.text}
                      style={{ marginRight: 10 }}
                    />
                    <ThemedText style={styles.modalItemText}>All Courses</ThemedText>
                  </TouchableOpacity>
                  <FlatList
                    data={activeCourses}
                    keyExtractor={(item) => item.id!}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <CourseItem
                        item={item}
                        isSelected={selectedCourses.includes(item.id!)}
                        onPress={() => {
                          setSelectedCourses(prev =>
                            selectedCourses.includes(item.id!)
                              ? prev.filter(id => id !== item.id)
                              : [...prev, item.id!]
                          );
                        }}
                        colors={colors}
                        styles={styles}
                      />
                    )}
                  />
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setIsPickerVisible(false)}
                  >
                    <ThemedText style={styles.modalCloseButtonText}>Close</ThemedText>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </BlurView>
          </Modal>
        </View>
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
  ));

  return (
    <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Analytics</ThemedText>
      </ThemedView>
      <FlatList
        data={paginatedHistory}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        keyExtractor={(item, index) => `${item.courseName}-${item.date}-${index}`}
        ListHeaderComponent={<ListHeader />}
        renderItem={({ item }) => {
          const recordDate = new Date(item.date);
          const formattedDate = recordDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
          let statusIcon: keyof typeof Ionicons.glyphMap = 'help-circle-outline';
          let statusColor = colors.text;
          let displayStatusText = 'Unknown';

          switch (item.status) {
            case 'present':
              statusIcon = 'checkmark-circle-outline';
              statusColor = Colors[colorScheme].success;
              displayStatusText = 'Present';
              break;
            case 'absent':
              statusIcon = 'close-circle-outline';
              statusColor = Colors[colorScheme].error;
              displayStatusText = 'Absent';
              break;
            case 'cancelled':
              statusIcon = 'remove-circle-outline';
              statusColor = Colors[colorScheme].warning;
              displayStatusText = 'Cancelled';
              break;
          }
          return (
            <TouchableOpacity style={styles.historyItem} onPress={() => handleAttendanceClick(item.courseId, item.id)}>
              <Ionicons name={statusIcon} size={18} color={statusColor} />
              <ThemedText style={[styles.historyText, { color: statusColor }]}>
                {item.courseName} - {displayStatusText}
              </ThemedText>
              <ThemedText style={styles.historyDateText}>on {formattedDate}</ThemedText>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={{ color: colors.text }}>No records found.</Text>}
        ListFooterComponent={
          <View>
            {filteredHistory.length > visibleHistoryCount && (
              <TouchableOpacity style={styles.showMoreButton} onPress={() => setVisibleHistoryCount(prev => prev + 10)}>
                <ThemedText style={styles.showMoreButtonText}>Show More</ThemedText>
              </TouchableOpacity>
            )}
            {visibleHistoryCount > 10 && (
              <TouchableOpacity style={styles.showLessButton} onPress={() => setVisibleHistoryCount(prev => Math.max(10, prev - 10))}>
                <ThemedText style={styles.showLessButtonText}>Show Less</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </ThemedView>
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
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
    marginBottom: 0,
    paddingHorizontal: 8,
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 10,
    
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
    backgroundColor: 'rgba(0,0,0,0.4)'
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
    color: 'white',
    fontWeight: 'bold',
  },
  doneButton: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors['light'].success,
    borderRadius: 5,
  },
  doneButtonText: {
    color: 'white',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
