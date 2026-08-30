import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Course } from '@/types';
import { Colors } from '@/constants/Colors';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Ionicons } from '@expo/vector-icons';

interface AttendanceTrendGraphProps {
  courses: Course[];
}

export function AttendanceTrendGraph({ courses }: AttendanceTrendGraphProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const activeCourses = courses.filter((c) => !c.isArchived);

  if (activeCourses.length === 0) {
    return (
      <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
        <ThemedText type="itemTitle" style={styles.cardTitle}>
          Overall Attendance
        </ThemedText>
        <ThemedText style={styles.emptyText}>No active courses available.</ThemedText>
      </ThemedView>
    );
  }

  // Aggregate stats across all active courses
  let totalPresents = 0;
  let totalAbsents = 0;
  let totalCancelled = 0;

  activeCourses.forEach((course) => {
    totalPresents += course.presents || 0;
    totalAbsents += course.absents || 0;
    totalCancelled += course.cancelled || 0;
  });

  const totalClasses = totalPresents + totalAbsents;
  const overallPercentage = totalClasses > 0 ? Math.round((totalPresents / totalClasses) * 100) : 100;
  const isTargetMet = overallPercentage >= 75;

  return (
    <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
      <View style={styles.headerRow}>
        <ThemedText type="itemTitle" style={styles.cardTitle}>
          Overall Attendance
        </ThemedText>

        <View style={[styles.statusPill, { backgroundColor: (isTargetMet ? Colors[colorScheme].success : Colors[colorScheme].error) + '18' }]}>
          <Ionicons
            name={isTargetMet ? 'checkmark-circle' : 'alert-circle'}
            size={14}
            color={isTargetMet ? Colors[colorScheme].success : Colors[colorScheme].error}
            style={{ marginRight: 4 }}
          />
          <ThemedText style={[styles.statusText, { color: isTargetMet ? Colors[colorScheme].success : Colors[colorScheme].error }]}>
            {isTargetMet ? 'On Track' : 'Below Target'}
          </ThemedText>
        </View>
      </View>

      {/* Main Stat Display */}
      <View style={styles.mainStatContainer}>
        <View style={styles.percentageWrapper}>
          <ThemedText style={styles.percentageText}>{overallPercentage}%</ThemedText>
          <ThemedText style={styles.percentageSubtext}>
            {totalPresents} of {totalClasses} classes attended
          </ThemedText>
        </View>
      </View>

      {/* Breakdown Pills */}
      <View style={styles.breakdownRow}>
        <View style={[styles.statTile, { backgroundColor: Colors[colorScheme].cardBackground }]}>
          <Ionicons name="checkmark-circle-outline" size={16} color={Colors[colorScheme].success} />
          <ThemedText style={styles.statTileValue}>{totalPresents}</ThemedText>
          <ThemedText style={styles.statTileLabel}>Attended</ThemedText>
        </View>

        <View style={[styles.statTile, { backgroundColor: Colors[colorScheme].cardBackground }]}>
          <Ionicons name="close-circle-outline" size={16} color={Colors[colorScheme].error} />
          <ThemedText style={styles.statTileValue}>{totalAbsents}</ThemedText>
          <ThemedText style={styles.statTileLabel}>Missed</ThemedText>
        </View>

        <View style={[styles.statTile, { backgroundColor: Colors[colorScheme].cardBackground }]}>
          <Ionicons name="remove-circle-outline" size={16} color={Colors[colorScheme].icon} />
          <ThemedText style={styles.statTileValue}>{totalCancelled}</ThemedText>
          <ThemedText style={styles.statTileLabel}>Cancelled</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mainStatContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  percentageWrapper: {
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 46,
    letterSpacing: -1,
    paddingTop: 4,
  },
  percentageSubtext: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statTile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    gap: 2,
  },
  statTileValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  statTileLabel: {
    fontSize: 11,
    opacity: 0.6,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    marginVertical: 16,
    fontSize: 14,
  },
});

export default AttendanceTrendGraph;
