import React, { useState } from 'react';
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
  const [widths, setWidths] = useState<Record<string, number>>({});
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
              disabled={!isDateInPast(date)}
              onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                setWidths((prev) => ({ ...prev, [`${classItem.course.id}-${index}`]: width }));
              }}
            >
              <View style={styles.verticalTextContainer}>
                <ThemedText style={[styles.courseCode, { color: 'white' }]} numberOfLines={1}>
                  {(widths[`${classItem.course.id}-${index}`] || 100) > 35
                    ? classItem.course.name
                    : classItem.course.id}
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
