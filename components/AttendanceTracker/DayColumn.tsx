import React, { useState, useContext } from 'react';
import { View, TouchableOpacity, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { format } from 'date-fns';
import { parseISOToDate, parse24HToDate, isDateInPast } from '@/utils/dateHelpers';
import { ClassItem } from '@/hooks/useAttendanceData';
import { Colors } from '@/constants/Colors';
import { AppContext } from '@/context/AppContext';

interface DayColumnProps {
  dateString: string;
  classes: ClassItem[];
  timeSlots: number[];
  startHour: number;
  styles: any;
  getBlockStyle: (classItem: ClassItem, date: Date) => object;
  handleSelectClass: (classItem: ClassItem, date: Date) => void;
  courseColors: Record<string, string>;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

const DayColumn: React.FC<DayColumnProps> = ({
  dateString,
  classes,
  timeSlots,
  startHour,
  styles,
  getBlockStyle,
  handleSelectClass,
  courseColors,
  weekStartsOn,
}) => {
  const { holidays } = useContext(AppContext);
  const date = parseISOToDate(dateString);
  const colorScheme = useColorScheme() ?? 'light';
  const dayOfWeek = format(date, 'EEEEE', { weekStartsOn });

  const holiday = holidays.find(h => {
    const startDate = parseISOToDate(h.startDate);
    const endDate = parseISOToDate(h.endDate);
    return date >= startDate && date <= endDate;
  });

  if (holiday) {
    return (
      <View style={styles.dayColumn}>
        <View style={styles.dayColumnHeader}>
          <ThemedText style={styles.dayInitialText}>{dayOfWeek}</ThemedText>
          <ThemedText style={styles.dateNumberText}>{format(date, 'd')}</ThemedText>
        </View>
        <View style={styles.dayColumnContent}>
          <View style={[styles.holidayBlock, { backgroundColor: Colors[colorScheme].tint }]}>
            <ThemedText style={styles.holidayText}>{holiday.name}</ThemedText>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dayColumn}>
      <View style={styles.dayColumnHeader}>
        <ThemedText style={styles.dayInitialText}>{dayOfWeek}</ThemedText>
        <ThemedText style={styles.dateNumberText}>{format(date, 'd')}</ThemedText>
      </View>
      <View style={styles.dayColumnContent}>
        {timeSlots.map(hour => (
          <View key={hour} style={[styles.gridLine, { top: (hour - startHour) * styles.timeLabel.height }]} />
        ))}
        {classes.map((classItem, index) => {
          const start = parse24HToDate(classItem.schedule.timeStart);
          const end = parse24HToDate(classItem.schedule.timeEnd);
          if (start.getHours() < startHour || end.getHours() > styles.endHour) return null;

          const duration = (end.getTime() - start.getTime()) / (1000 * 60);
          const top = (start.getHours() - startHour + start.getMinutes() / 60) * styles.timeLabel.height;
          const height = (duration / 60) * styles.timeLabel.height;

          return (
            <TouchableOpacity
              key={`${classItem.course.id}-${index}`}
              style={[
                getBlockStyle(classItem, date),
                { top, height },
              ]}
              onPress={() => handleSelectClass(classItem, date)}
              disabled={!isDateInPast(date)}
            >
              <View style={[
                styles.verticalTextContainer,
                {
                  width: height,
                  height: styles.dayColumn.width - 8, // classBlock has left: 4, right: 4
                }
              ]}>
                <ThemedText
                  style={[styles.courseCode, { color: 'white' }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {classItem.course.name}
                </ThemedText>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default DayColumn;
