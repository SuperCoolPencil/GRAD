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

  // compute headerHeight safely (fallback to a sensible value)
  const headerHeight = (styles && styles.dayColumnHeader && styles.dayColumnHeader.height) ? styles.dayColumnHeader.height : 48;

  if (holiday) {
    // Render the column with the regular header, and a full-height holiday block
    return (
      <View style={[styles.dayColumn, { position: 'relative' }]}>
        <View style={styles.dayColumnHeader}>
          <ThemedText style={styles.dayInitialText}>{dayOfWeek}</ThemedText>
          <ThemedText style={styles.dateNumberText}>{format(date, 'd')}</ThemedText>
        </View>

        {/* Full-height holiday block that fills the column from just below the header to the bottom */}
        <View
          style={{
            position: 'absolute',
            top: headerHeight,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 8,
            backgroundColor: Colors[colorScheme].card,
            zIndex: 2,
          }}
          accessible
          accessibilityLabel={`Holiday: ${holiday.name}`}
        >
          <View
            style={{
              transform: [{ rotate: '90deg' }],
              // Give the rotated view plenty of room in its unrotated axis so the text won't be clipped
              width: Math.max(200, styles?.dayColumn?.width ?? 200),
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible',
            }}
          >
            <ThemedText
              style={[styles.courseCode, { color: 'white', textAlign: 'center' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              ellipsizeMode="tail"
            >
              {holiday.name}
            </ThemedText>
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
