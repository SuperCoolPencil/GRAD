import React, { useMemo } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Course, AttendanceRecord } from '@/types';
import { Colors } from '@/constants/Colors';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Ionicons } from '@expo/vector-icons';
import { calculateAttendancePercentage } from '@/utils/attendance';
import { parseISOToDate } from '@/utils/dateHelpers';

interface AttendanceTrendGraphProps {
  courses: Course[];
}

const getWeekdayName = (dateStr: string): string => {
  const d = parseISOToDate(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getDay()];
};

const SCHEDULE_DAY_TO_SHORT_NAME: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export function AttendanceTrendGraph({ courses }: AttendanceTrendGraphProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const activeCourses = useMemo(() => courses.filter((c) => !c.isArchived), [courses]);

  // Flatten all records chronologically
  const allRecords = useMemo(() => {
    const list: AttendanceRecord[] = [];
    activeCourses.forEach((c) => {
      if (c.attendanceRecords) {
        list.push(...c.attendanceRecords);
      }
    });
    list.sort((a, b) => a.date.localeCompare(b.date) || a.timeStart.localeCompare(b.timeStart));
    return list;
  }, [activeCourses]);

  // Day-of-the-Week Breakdown Stats
  const dayOfWeekStats = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const regularClassDays = new Set(
      activeCourses.flatMap(course =>
        (course.weeklySchedule || [])
          .map(item => SCHEDULE_DAY_TO_SHORT_NAME[item.day.toLowerCase()])
          .filter((day): day is string => Boolean(day)),
      ),
    );
    const map: Record<string, { present: number; absent: number; total: number }> = {
      Mon: { present: 0, absent: 0, total: 0 },
      Tue: { present: 0, absent: 0, total: 0 },
      Wed: { present: 0, absent: 0, total: 0 },
      Thu: { present: 0, absent: 0, total: 0 },
      Fri: { present: 0, absent: 0, total: 0 },
      Sat: { present: 0, absent: 0, total: 0 },
      Sun: { present: 0, absent: 0, total: 0 },
    };

    allRecords.forEach((r) => {
      const day = getWeekdayName(r.date);
      if (map[day]) {
        if (r.status === 'present') {
          map[day].present++;
          map[day].total++;
        } else if (r.status === 'absent') {
          map[day].absent++;
          map[day].total++;
        }
      }
    });

    return days.filter(day => regularClassDays.has(day)).map((day) => {
      const { present, absent, total } = map[day];
      const pct = calculateAttendancePercentage(present, absent);
      return { day, present, absent, total, pct };
    });
  }, [activeCourses, allRecords]);

  // Identify Weakest and Best Days
  const weakestDay = useMemo(() => {
    const activeDays = dayOfWeekStats.filter((d) => d.total > 0 && d.absent > 0);
    if (activeDays.length === 0) return null;
    return activeDays.reduce((min, d) => (d.pct < min.pct ? d : min), activeDays[0]);
  }, [dayOfWeekStats]);

  const bestDay = useMemo(() => {
    const activeDays = dayOfWeekStats.filter((d) => d.total > 0);
    if (activeDays.length === 0) return null;
    return activeDays.reduce((max, d) => (d.pct > max.pct ? d : max), activeDays[0]);
  }, [dayOfWeekStats]);

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
  const overallPercentage = calculateAttendancePercentage(totalPresents, totalAbsents);
  const isTargetMet = activeCourses.every(course =>
    calculateAttendancePercentage(course.presents || 0, course.absents || 0) >= (course.requiredAttendance ?? 75)
  );

  return (
    <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <ThemedText type="itemTitle" style={styles.cardTitle}>
          Overall Attendance
        </ThemedText>

        <View
          style={[
            styles.statusPill,
            { backgroundColor: (isTargetMet ? Colors[colorScheme].success : Colors[colorScheme].error) + '18' },
          ]}
        >
          <Ionicons
            name={isTargetMet ? 'checkmark-circle' : 'alert-circle'}
            size={14}
            color={isTargetMet ? Colors[colorScheme].success : Colors[colorScheme].error}
            style={{ marginRight: 4 }}
          />
          <ThemedText
            style={[
              styles.statusText,
              { color: isTargetMet ? Colors[colorScheme].success : Colors[colorScheme].error },
            ]}
          >
            {isTargetMet ? 'On Track' : 'Below Target'}
          </ThemedText>
        </View>
      </View>

      {/* Main Percentage Display */}
      <View style={styles.mainStatContainer}>
        <View style={styles.percentageWrapper}>
          <ThemedText style={styles.percentageText}>{overallPercentage}%</ThemedText>
          <ThemedText style={styles.percentageSubtext}>
            {totalPresents} of {totalClasses} classes attended
          </ThemedText>
        </View>
      </View>

      {/* Summary Stat Tiles */}
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

      {/* Day-of-the-Week Breakdown */}
      {dayOfWeekStats.some((d) => d.total > 0) && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionHeaderTitle}>DAY-OF-WEEK BREAKDOWN</ThemedText>
            {weakestDay && (
              <View style={styles.weakestCallout}>
                <Ionicons name="warning-outline" size={12} color={Colors[colorScheme].warning} />
                <ThemedText style={[styles.weakestCalloutText, { color: Colors[colorScheme].warning }]}>
                  {weakestDay.day} is lowest ({weakestDay.pct}%)
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.weekdayGrid}>
            {dayOfWeekStats.map((item) => {
              const isWeakest = weakestDay?.day === item.day;
              const isBest = bestDay?.day === item.day && bestDay.pct > (weakestDay?.pct || 0);

              let badgeBg = Colors[colorScheme].cardBackground;
              let badgeBorderColor = 'transparent';

              if (isWeakest) {
                badgeBg = Colors[colorScheme].warning + '18';
                badgeBorderColor = Colors[colorScheme].warning + '40';
              } else if (isBest) {
                badgeBg = Colors[colorScheme].success + '18';
                badgeBorderColor = Colors[colorScheme].success + '40';
              }

              return (
                <View
                  key={item.day}
                  style={[
                    styles.weekdayTile,
                    {
                      backgroundColor: badgeBg,
                      borderColor: badgeBorderColor,
                      borderWidth: isWeakest || isBest ? 1 : 0,
                    },
                  ]}
                >
                  <ThemedText style={styles.weekdayName}>{item.day}</ThemedText>
                  <ThemedText
                    style={[
                      styles.weekdayPct,
                      {
                        color:
                          item.total === 0
                            ? Colors[colorScheme].icon
                            : item.pct >= 75
                            ? Colors[colorScheme].success
                            : Colors[colorScheme].error,
                      },
                    ]}
                  >
                    {item.total > 0 ? `${item.pct}%` : '-'}
                  </ThemedText>
                  <ThemedText style={styles.weekdayCount}>
                    {item.total > 0 ? `${item.present}/${item.total}` : '0 classes'}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      )}
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
    marginVertical: 4,
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
    marginTop: 12,
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
  sectionContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.5,
    letterSpacing: 0.5,
  },
  weakestCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weakestCalloutText: {
    fontSize: 11,
    fontWeight: '600',
  },
  weekdayGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  weekdayTile: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
  },
  weekdayName: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.7,
  },
  weekdayPct: {
    fontSize: 13,
    fontWeight: '700',
    marginVertical: 2,
  },
  weekdayCount: {
    fontSize: 9,
    opacity: 0.5,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    marginVertical: 16,
    fontSize: 14,
  },
});

export default AttendanceTrendGraph;
