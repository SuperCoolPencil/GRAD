import React, { useMemo } from 'react';
import { FlatList, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { AttendanceRecord, Course } from '@/types';
import PaginationControls from './PaginationControls';
import ExtraClassTag from './ui/ExtraClassTag';

interface AttendanceHistoryProps {
  title: string;
  courseId?: string;
  records: AttendanceRecord[];
  courses: Course[];
  onRecordClick: (record: AttendanceRecord) => void;
  ListHeaderComponent?: React.ReactElement;
  currentPage: number;
  totalRecords: number;
  recordsPerPage: number;
  onPageChange: (page: number) => void;
  ListFooterComponent?: React.ReactElement;
  ItemSeparatorComponent?: React.ComponentType<any> | null;
}

const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({
  title,
  courseId,
  records,
  courses,
  onRecordClick,
  ListHeaderComponent,
  currentPage,
  totalRecords,
  recordsPerPage,
  onPageChange,
  ListFooterComponent,
  ItemSeparatorComponent,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const styles = getStyles(colorScheme);

  const renderItem = ({ item }: { item: AttendanceRecord }) => {
    const recordDate = new Date(item.date);
    const formattedDate = recordDate.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    });
    let statusIcon: keyof typeof Ionicons.glyphMap = 'help-circle-outline';
    let statusColor = Colors[colorScheme].text;
    let displayStatusText = 'Unknown';

    const course = courses?.find((c) => c.id === item.course_id);
    const courseName = course ? course.name : item.course_id;

    switch (item.status) {
      case 'present':
        statusIcon = 'checkmark-circle-outline';
        statusColor = Colors[colorScheme].success;
        displayStatusText = courseId ? 'Present' : `${courseName} - Present`;
        break;
      case 'absent':
        statusIcon = 'close-circle-outline';
        statusColor = Colors[colorScheme].error;
        displayStatusText = courseId ? 'Absent' : `${courseName} - Absent`;
        break;
      case 'cancelled':
        statusIcon = 'remove-circle-outline';
        statusColor = Colors[colorScheme].icon;
        displayStatusText = courseId ? 'Cancelled' : `${courseName} - Cancelled`;
        break;
    }

    return (
      <TouchableOpacity style={styles.historyItem} onPress={() => onRecordClick(item)}>
        <Ionicons name={statusIcon} size={18} color={statusColor} />
        <ThemedText style={[styles.historyText, { color: statusColor }]}>
          {displayStatusText}

        </ThemedText>
        <ThemedView style={styles.historyDateContainer}>
          {item.isExtraClass && <ExtraClassTag style={{ marginRight: 8 }} />}
          <ThemedText style={styles.historyDateText}>{formattedDate}</ThemedText>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  const displayedRecords = useMemo(() => {
    if (courseId) {
      return records.filter((record) => record.course_id === courseId);
    }
    return records;
  }, [records, courseId]);

  return (
    <ThemedView style={styles.card}>
      <ThemedText type="subtitle" style={styles.cardTitle}>
        {title}
      </ThemedText>
      {ListHeaderComponent}
      <FlatList
        data={displayedRecords}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListFooterComponent={
          ListFooterComponent || (
            <PaginationControls
              currentPage={currentPage}
              totalRecords={totalRecords}
              recordsPerPage={recordsPerPage}
              onPageChange={onPageChange}
            />
          )
        }
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListEmptyComponent={<ThemedText style={styles.emptyText}>No records found.</ThemedText>}
      />
    </ThemedView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 16,
    color: Colors[colorScheme].text,
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 16,
  },
  cardTitle: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8, // Increased padding for breathing room
    paddingHorizontal: 8,
    marginBottom: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)', // Subtle hover-like background
  },
  historyText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '500',
  },
  historyDateText: {
    fontSize: 14,
    opacity: 0.8,
  },
  historyDateContainer: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent', // Make parent background transparent to see card bg
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.7,
  },
});

export default AttendanceHistory;
