import React from 'react';
import { View, TouchableOpacity, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { format } from 'date-fns';
import { parseISOToDate, parse24HToDate, isDateInPast } from '@/utils/dateHelpers';
import { ClassItem } from '@/hooks/useAttendanceData';
import { Colors } from '@/constants/Colors';

interface DayColumnProps {
  dateString: string;
  classes: ClassItem[];
  timeSlots: number[];
  startHour: number;
  styles: any;
  getBlockStyle: (classItem: ClassItem, date: Date) => object;
  handleSelectClass: (classItem: ClassItem, date: Date) => void;
  courseColors: Record<string, string>;
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
}) => {
  const date = parseISOToDate(dateString);
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={styles.dayColumn}>
      <View style={styles.dayColumnHeader}>
        <ThemedText style={styles.dayInitialText}>{format(date, 'EEEEE')}</ThemedText>
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
            >
              <View style={styles.verticalTextContainer}>
                <ThemedText style={[styles.courseCode, { color: 'white' }]} numberOfLines={1}>{classItem.course.name}</ThemedText>
              </View>
              {isDateInPast(date) && (classItem.attendance?.status === 'present' || classItem.attendance?.status === 'absent') && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 5,
                    left: 5,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: classItem.attendance.status === 'present'
                      ? Colors[colorScheme].success
                      : Colors[colorScheme].error,
                  }}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default DayColumn;
