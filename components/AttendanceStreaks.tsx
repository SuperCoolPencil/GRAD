import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Course } from '@/types';
import { getAttendanceStreaks } from '@/utils/attendance';
import { Colors } from '@/constants/Colors';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface AttendanceStreaksProps {
  courses: Course[];
}

export function AttendanceStreaks({ courses }: AttendanceStreaksProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const styles = getStyles(colorScheme);

  return (
    <ThemedView style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="flame-outline" size={21} color={Colors[colorScheme].warning} />
        <ThemedText type="itemTitle" style={styles.title}>Attendance streaks</ThemedText>
      </View>
      {courses.length === 0 ? (
        <ThemedText style={styles.emptyText}>Add a course to start tracking streaks.</ThemedText>
      ) : courses.map(course => {
        const streaks = getAttendanceStreaks(course.attendanceRecords || []);
        return (
          <View key={course.id} style={styles.row}>
            <ThemedText style={styles.courseName} numberOfLines={1}>{course.name}</ThemedText>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <ThemedText style={styles.metricValue}>{streaks.current}</ThemedText>
                <ThemedText style={styles.metricLabel}>current</ThemedText>
              </View>
              <View style={styles.metric}>
                <ThemedText style={styles.metricValue}>{streaks.longest}</ThemedText>
                <ThemedText style={styles.metricLabel}>best</ThemedText>
              </View>
            </View>
          </View>
        );
      })}
    </ThemedView>
  );
}

const getStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  card: {
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 20,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    marginLeft: 8,
  },
  row: {
    alignItems: 'center',
    borderTopColor: Colors[colorScheme].separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
  },
  courseName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 12,
  },
  metrics: {
    flexDirection: 'row',
    gap: 16,
  },
  metric: {
    alignItems: 'center',
    minWidth: 38,
  },
  metricValue: {
    color: Colors[colorScheme].warning,
    fontSize: 17,
    fontWeight: '700',
  },
  metricLabel: {
    color: Colors[colorScheme].textSecondary,
    fontSize: 11,
  },
  emptyText: {
    color: Colors[colorScheme].textSecondary,
    fontSize: 14,
    paddingVertical: 8,
  },
});
