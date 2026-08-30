import React, { useContext } from 'react';
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
  handleLongPressClass?: (classItem: ClassItem) => void;
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
  handleLongPressClass,
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

  const gridHeight = styles.gridHeight;

  // Check if this column is today and calculate current time position
  const now = new Date();
  const isToday = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const isCurrentTimeVisible = isToday && currentHour >= startHour && currentHour <= styles.endHour;
  const currentTimeTop = isCurrentTimeVisible
    ? (currentHour - startHour) * 60
    : 0;

  if (holiday) {
    return (
      <View style={styles.dayColumn}>
        {/* Header - inline */}
        <View style={styles.dayColumnHeader}>
          <ThemedText style={styles.dayInitialText}>{dayOfWeek}</ThemedText>
          <ThemedText style={styles.dateNumberText}>{format(date, 'd')}</ThemedText>
        </View>

        {/* Grid content with holiday block */}
        <View style={[styles.dayColumnContent, { height: gridHeight }]}>
          {/* Grid lines */}
          <View style={[styles.gridLine, { top: 0 }]} />
          {timeSlots.map(hour => (
            <View key={hour} style={[styles.gridLine, { top: (hour - startHour) * 60 }]} />
          ))}
          <View style={[styles.gridLine, { top: gridHeight - 1 }]} />

          {/* Holiday - full column, no margins */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.08)', // Subtle holiday background
            }}
            accessible
            accessibilityLabel={`Holiday: ${holiday.name}`}
          >
            <View
              style={[
                styles.verticalTextContainer,
                {
                  width: gridHeight,
                  height: styles.dayColumn?.width || 40,
                }
              ]}
            >
              <ThemedText
                style={[styles.courseCode, { color: Colors[colorScheme].text }]}
              >
                {holiday.name}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dayColumn}>
      {/* Header - inline */}
      <View style={styles.dayColumnHeader}>
        <ThemedText style={styles.dayInitialText}>{dayOfWeek}</ThemedText>
        <ThemedText style={styles.dateNumberText}>{format(date, 'd')}</ThemedText>
      </View>

      {/* Grid content */}
      <View style={[styles.dayColumnContent, { height: gridHeight }]}>
        {/* Grid lines */}
        <View style={[styles.gridLine, { top: 0 }]} />
        {timeSlots.map(hour => (
          <View key={hour} style={[styles.gridLine, { top: (hour - startHour) * 60 }]} />
        ))}
        <View style={[styles.gridLine, { top: gridHeight - 1 }]} />

        {/* Current time indicator */}
        {isCurrentTimeVisible && styles.currentTimeIndicator && (
          <View style={[styles.currentTimeIndicator, { top: currentTimeTop }]} />
        )}

        {/* Class blocks */}
        {classes.map((classItem, index) => {
          const start = parse24HToDate(classItem.schedule.timeStart);
          const end = parse24HToDate(classItem.schedule.timeEnd);
          const startTime = start.getHours() + start.getMinutes() / 60;
          const endTime = end.getHours() + end.getMinutes() / 60;
          if (startTime < startHour || endTime > styles.endHour) return null;

          const duration = (end.getTime() - start.getTime()) / (1000 * 60);
          const top = (startTime - startHour) * 60;
          const height = duration;

          return (
            <TouchableOpacity
              key={`${classItem.course.id}-${index}`}
              style={[
                getBlockStyle(classItem, date),
                { top, height },
              ]}
              onPress={() => {
                if (isDateInPast(date) || format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
                  handleSelectClass(classItem, date);
                }
              }}
              onLongPress={() => handleLongPressClass?.(classItem)}
            >
              {isDateInPast(date) && classItem.attendance?.status === 'present' && (
                <View style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  backgroundColor: Colors[colorScheme].success,
                  zIndex: 2,
                }} />
              )}
              {isDateInPast(date) && classItem.attendance?.status === 'absent' && (
                <View style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  backgroundColor: Colors[colorScheme].error,
                  zIndex: 2,
                }} />
              )}
              <View style={[
                styles.verticalTextContainer,
                {
                  width: height,
                  height: styles.dayColumn.width - 8,
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
