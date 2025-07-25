import React, { useContext, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, View, Dimensions, FlatList, Text, TouchableOpacity, Modal, useColorScheme } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { RadarChart } from '@salmonco/react-native-radar-chart';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import { AppContext } from '@/context/AppContext';
import { calculateAttendancePercentage, generateHeatmapData, getOldestRecordDate } from '@/utils/attendance';
import { useTheme } from '@react-navigation/native';
import HeatmapComponent from '@/components/Heatmap';
import { Colors } from '@/constants/Colors';

// Constants from HeatmapComponent to calculate layout
const CELL_SIZE = 20;
const CELL_MARGIN = 4;
const WEEKDAY_LABEL_WIDTH = 40; // Approx width for "Sun", "Mon", etc. labels

export default function AnalyticsScreen() {
  const { courses } = useContext(AppContext);
  const { colors } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const styles = useMemo(() => getStyles(colors, colorScheme), [colors, colorScheme]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(10);

  // State for heatmap pagination
  const [currentPage, setCurrentPage] = useState(0);

  const chartData = courses.map(course => ({
    label: course.name,
    value: calculateAttendancePercentage(course.presents, course.absents),
  }));

  const oldestRecordDate = useMemo(() => getOldestRecordDate(courses), [courses]);

  const { heatmapData, totalPages } = useMemo(() => {
    if (!oldestRecordDate) {
      return { heatmapData: [], totalPages: 0 };
    }

    const screenWidth = Dimensions.get('window').width;
    const availableWidth = screenWidth - WEEKDAY_LABEL_WIDTH - 32; // 32 for card padding
    const weekWidth = CELL_SIZE + CELL_MARGIN;
    const weeksPerPage = Math.floor(availableWidth / weekWidth);

    const today = new Date();
    const totalDays = Math.ceil((today.getTime() - oldestRecordDate.getTime()) / (1000 * 3600 * 24)) + 1;
    const totalWeeks = Math.ceil(totalDays / 7);
    const calculatedTotalPages = Math.ceil(totalWeeks / weeksPerPage);

    const startWeek = currentPage * weeksPerPage;
    const endWeek = startWeek + weeksPerPage;

    const startDate = new Date(oldestRecordDate);
    startDate.setDate(startDate.getDate() + (startWeek * 7));
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (weeksPerPage * 7) - 1);

    const data = generateHeatmapData(courses, startDate, new Date(Math.min(endDate.getTime(), today.getTime())));
    
    return { heatmapData: data, totalPages: calculatedTotalPages };
  }, [courses, oldestRecordDate, currentPage]);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate: Date | undefined) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const filteredHistory = courses.flatMap(course =>
    (course.attendanceRecords || []).map(record => ({ ...record, courseName: course.name, courseId: course.id }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
   .filter(record => {
    const courseMatch = selectedCourse ? record.courseId === selectedCourse : true;
    const recordDate = new Date(record.date);
    const dateMatch = date.toDateString() === recordDate.toDateString();
    return courseMatch && dateMatch;
  });

  const paginatedHistory = filteredHistory.slice(0, visibleHistoryCount);

  return (
    <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Analytics</ThemedText>
      </ThemedView>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.contentContainer}
      >
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
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.heatmapHeader}>
            <TouchableOpacity onPress={handlePrevPage} disabled={currentPage === 0}>
              <Ionicons name="chevron-back" size={24} color={currentPage === 0 ? colors.border : colors.text} />
            </TouchableOpacity>
            <ThemedText style={styles.sectionTitle} type="subtitle">
              Page {currentPage + 1} of {totalPages}
            </ThemedText>
            <TouchableOpacity onPress={handleNextPage} disabled={currentPage >= totalPages - 1}>
              <Ionicons name="chevron-forward" size={24} color={currentPage >= totalPages - 1 ? colors.border : colors.text} />
            </TouchableOpacity>
          </View>
          <HeatmapComponent data={heatmapData} />
        </ThemedView>
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.sectionTitle} type="subtitle">Attendance History</ThemedText>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Course:</ThemedText>
            <TouchableOpacity style={styles.pickerTrigger} onPress={() => setIsPickerVisible(true)}>
              <ThemedText style={styles.pickerTriggerText}>
                {selectedCourse ? courses.find(c => c.id === selectedCourse)?.name ?? 'Select a course...' : 'Select a course...'}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color={colors.text} />
            </TouchableOpacity>
            <Modal
              transparent={true}
              visible={isPickerVisible}
              animationType="fade"
              onRequestClose={() => setIsPickerVisible(false)}
            >
              <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPressOut={() => setIsPickerVisible(false)}>
                <View style={styles.modalContent}>
                  <FlatList
                    data={[{ id: null, name: 'All Courses' }, ...courses]}
                    keyExtractor={(item) => item.id || 'all-courses'}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.modalItem} onPress={() => {
                        setSelectedCourse(item.id);
                        setIsPickerVisible(false);
                      }}>
                        <ThemedText style={styles.modalItemText}>{item.name}</ThemedText>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Date:</ThemedText>
            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
              <ThemedText style={styles.datePickerText}>{formatDate(date)}</ThemedText>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker value={date} mode="date" onChange={handleDateChange} />
            )}
          </View>
          <FlatList
            data={paginatedHistory}
            keyExtractor={(item, index) => `${item.courseName}-${item.date}-${index}`}
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
                <View style={styles.historyItem}>
                  <Ionicons name={statusIcon} size={18} color={statusColor} />
                  <ThemedText style={[styles.historyText, { color: statusColor }]}>
                    {item.courseName} - {displayStatusText}
                  </ThemedText>
                  <ThemedText style={styles.historyDateText}>on {formattedDate}</ThemedText>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={{ color: colors.text }}>No records found.</Text>}
            ListFooterComponent={
              filteredHistory.length > visibleHistoryCount ? (
                <TouchableOpacity style={styles.showMoreButton} onPress={() => setVisibleHistoryCount(prev => prev + 10)}>
                  <ThemedText style={styles.showMoreButtonText}>Show More</ThemedText>
                </TouchableOpacity>
              ) : null
            }
          />
        </ThemedView>
      </ScrollView>
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
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
  },
  modalItemText: {
    fontSize: 16,
    color: colors.text,
  },
  showMoreButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 5,
  },
  showMoreButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
