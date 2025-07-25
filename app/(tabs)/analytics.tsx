import React, { useContext, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, View, Dimensions, FlatList, Text, TouchableOpacity, Modal, useColorScheme } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { RadarChart } from '@salmonco/react-native-radar-chart';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import { AppContext } from '@/context/AppContext';
import { calculateAttendancePercentage, generateHeatmapData } from '@/utils/attendance';
import { useTheme } from '@react-navigation/native';
import HeatmapComponent from '@/components/Heatmap';
import { Colors } from '@/constants/Colors';

export default function AnalyticsScreen() {
  const { courses } = useContext(AppContext);
  const { colors } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const styles = useMemo(() => getStyles(colors, colorScheme), [colors, colorScheme]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [date, setDate] = useState(new Date()); // State for the selected date
  const [showDatePicker, setShowDatePicker] = useState(false); // State for date picker visibility
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(10);

  const chartData = courses.map(course => ({
    label: course.name,
    value: calculateAttendancePercentage(course.presents, course.absents),
  }));

  const heatmapData = generateHeatmapData(courses);

  const allAttendanceRecords = courses.flatMap(course =>
    (course.attendanceRecords || []).map(record => ({ ...record, courseName: course.name, courseId: course.id }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  const filteredHistory = allAttendanceRecords.filter(record => {
    const courseMatch = selectedCourse ? record.courseId === selectedCourse : true;
    const recordDate = new Date(record.date);
    const dateMatch = date.toDateString() === recordDate.toDateString(); // Compare dates without time
    return courseMatch && dateMatch;
  });

  const paginatedHistory = filteredHistory.slice(0, visibleHistoryCount);

  return (
    <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">
          Analytics
        </ThemedText>
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
            gradientColor={{
              startColor: '#393939',
              endColor: '#393939',
              count: 5,
            }}
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
          <ThemedText style={styles.sectionTitle} type="subtitle">Daily Activity</ThemedText>
          <HeatmapComponent data={heatmapData} />
        </ThemedView>
        <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.sectionTitle} type="subtitle">Attendance History</ThemedText>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Course:</ThemedText>
            <TouchableOpacity
              style={styles.pickerTrigger}
              onPress={() => setIsPickerVisible(true)}
            >
              <ThemedText style={styles.pickerTriggerText}>
                {selectedCourse
                  ? courses.find(c => c.id === selectedCourse)?.name ?? 'Select a course...'
                  : 'Select a course...'}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color={colors.text} />
            </TouchableOpacity>
            <Modal
              transparent={true}
              visible={isPickerVisible}
              animationType="fade"
              onRequestClose={() => setIsPickerVisible(false)}
            >
              <TouchableOpacity
                style={styles.modalContainer}
                activeOpacity={1}
                onPressOut={() => setIsPickerVisible(false)}
              >
                <View style={styles.modalContent}>
                  <FlatList
                    data={[{ id: null, name: 'All Courses' }, ...courses]}
                    keyExtractor={(item) => item.id || 'all-courses'}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalItem}
                        onPress={() => {
                          setSelectedCourse(item.id);
                          setIsPickerVisible(false);
                        }}
                      >
                        <ThemedText style={styles.modalItemText}>
                          {item.name}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
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
          <FlatList
            data={paginatedHistory}
            keyExtractor={(item, index) => `${item.courseName}-${item.date}-${index}`}
            renderItem={({ item }) => {
              const recordDate = new Date(item.date);
              const formattedDate = recordDate.toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric'
              });
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
                  <ThemedText style={styles.historyDateText}>
                    on {formattedDate}
                  </ThemedText>
                </View>
              )
            }}
            ListEmptyComponent={<Text style={{ color: colors.text }}>No records found.</Text>}
            ListFooterComponent={
              filteredHistory.length > visibleHistoryCount ? (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setVisibleHistoryCount(prev => prev + 10)}
                >
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
