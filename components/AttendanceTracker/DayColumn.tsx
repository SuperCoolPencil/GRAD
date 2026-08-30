import React, { useContext } from 'react';
import { View, TouchableOpacity, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { format } from 'date-fns';
import { parseISOToDate, parse24HToDate, isDateInPast } from '@/utils/dateHelpers';
import { ClassItem } from '@/hooks/useAttendanceData';
import { Colors } from '@/constants/Colors';
import { AppContext } from '@/context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { isClassSkippedBySkipDay } from '@/utils/attendance';

interface DayColumnProps {
  dateString: string;
  classes: ClassItem[];
  startHour: number;
  styles: any;
  getBlockStyle: (classItem: ClassItem, date: Date) => object;
  handleSelectClass: (classItem: ClassItem, date: Date) => void;
  handleLongPressClass?: (classItem: ClassItem) => void;
  courseColors: Record<string, string>;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  onHeaderPress: (dateString: string) => void;
}

const DayColumn: React.FC<DayColumnProps> = ({
  dateString,
  classes,
  startHour,
  styles,
  getBlockStyle,
  handleSelectClass,
  handleLongPressClass,
  courseColors,
  weekStartsOn,
  onHeaderPress,
}) => {
  const { holidays, skipDays } = useContext(AppContext);
  const date = parseISOToDate(dateString);
  const colorScheme = useColorScheme() ?? 'light';
  const dayOfWeek = format(date, 'EEEEE', { weekStartsOn });

  const holiday = holidays.find(h => {
    const startDate = parseISOToDate(h.startDate);
    const endDate = parseISOToDate(h.endDate);
    return date >= startDate && date <= endDate;
  });
  const skipDay = skipDays.find(day => {
    const startDate = day.date;
    const endDate = day.endDate || day.date;
    return !day.courseId && !day.timeStart && dateString >= startDate && dateString <= endDate;
  });
  const dayEvent = holiday
    ? { label: holiday.name, backgroundColor: 'rgba(255, 255, 255, 0.08)' }
    : skipDay
      ? {
          label: skipDay.reason || 'Skip Day',
          backgroundColor: colorScheme === 'dark' ? 'rgba(201, 61, 51, 0.14)' : 'rgba(251, 30, 8, 0.12)',
        }
      : null;

  const renderHeader = () => (
    <TouchableOpacity
      style={styles.dayColumnHeader}
      onPress={() => onHeaderPress(dateString)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Manage ${format(date, 'EEEE, MMMM d')}`}
    >
      <ThemedText style={styles.dayInitialText}>{dayOfWeek}</ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <ThemedText style={styles.dateNumberText}>{format(date, 'd')}</ThemedText>
        {holiday && <Ionicons name="calendar" size={11} color={Colors[colorScheme].tint} />}
        {!holiday && skipDay && <Ionicons name="close-circle" size={11} color={Colors[colorScheme].error} />}
      </View>
    </TouchableOpacity>
  );

  const renderDayEventTint = (backgroundColor: string) => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor,
      }}
    />
  );

  const renderDayEventLabel = (label: string) => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={[
          styles.verticalTextContainer,
          {
            width: gridHeight,
            height: styles.dayColumn.width,
          },
        ]}
      >
        <ThemedText style={[styles.courseCode, { color: Colors[colorScheme].text }]}>{label}</ThemedText>
      </View>
    </View>
  );

  const gridHeight = styles.gridHeight;

  // Check if this column is today and calculate current time position
  const now = new Date();
  const isToday = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const isCurrentTimeVisible = isToday && currentHour >= startHour && currentHour <= styles.endHour;
  const currentTimeTop = isCurrentTimeVisible
    ? (currentHour - startHour) * 60
    : 0;

  if (dayEvent) {
    return (
      <View style={styles.dayColumn}>
        {/* Header - inline */}
        {renderHeader()}

        {/* Full-day event lane */}
        <View style={[styles.dayColumnContent, { height: gridHeight }]}>
          {renderDayEventTint(dayEvent.backgroundColor)}
          {renderDayEventLabel(dayEvent.label)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dayColumn}>
      {/* Header - inline */}
      {renderHeader()}

      {/* Grid content */}
      <View style={[styles.dayColumnContent, { height: gridHeight }]}>
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

          const isSkippedByPlan = isClassSkippedBySkipDay(
            dateString,
            classItem.course.id,
            classItem.schedule.timeStart,
            classItem.schedule.timeEnd,
            skipDays
          );

          return (
            <TouchableOpacity
              key={`${classItem.course.id}-${index}`}
              style={[
                getBlockStyle(classItem, date),
                { top, height },
                isSkippedByPlan && { opacity: 0.8 },
              ]}
              onPress={() => {
                handleSelectClass(classItem, date);
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
              {isSkippedByPlan && (
                <View style={{
                  position: 'absolute',
                  right: 2,
                  top: 2,
                  zIndex: 3,
                }}>
                  <Ionicons name="close-circle" size={12} color="rgba(255, 255, 255, 0.9)" />
                </View>
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
