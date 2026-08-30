import React, { useState, useCallback, useMemo, useContext } from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme, useWindowDimensions, ScrollView, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { AppContext } from '@/context/AppContext';
import { format } from 'date-fns';
import { Link, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getWeekStartDate, getWeekEndDate, isDateInPast, addWeeksToDate, subWeeksFromDate } from '@/utils/dateHelpers';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAttendanceData, ClassItem } from '@/hooks/useAttendanceData';
import { useAttendanceActions } from '@/hooks/useAttendanceActions';
import TimeAxis from '@/components/AttendanceTracker/TimeAxis';
import DayColumn from '@/components/AttendanceTracker/DayColumn';

export default function VisualAttendanceTracker() {
  const { is24Hour, weekStartsOn } = useContext(AppContext);
  const colorScheme = useColorScheme() ?? 'light';
  const [startDate, setStartDate] = useState(() => getWeekStartDate(new Date(), weekStartsOn));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  const { classes, courseColors, startHour, endHour, loading, error } = useAttendanceData(startDate, weekStartsOn, true);
  const { handleSelectClass } = useAttendanceActions();
  const router = useRouter();

  // Check if there are any classes this week
  const hasClasses = useMemo(() => {
    return Object.values(classes).some(dayClasses => dayClasses.length > 0);
  }, [classes]);

  // Update startDate when weekStartsOn changes
  React.useEffect(() => {
    setStartDate(getWeekStartDate(new Date(), weekStartsOn));
  }, [weekStartsOn]);

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setStartDate(getWeekStartDate(selectedDate, weekStartsOn));
    }
  };

  const handlePrevWeek = () => {
    setStartDate(prevDate => subWeeksFromDate(prevDate, 1));
  };

  const handleNextWeek = () => {
    setStartDate(prevDate => addWeeksToDate(prevDate, 1));
  };

  const HOUR_HEIGHT = 60;
  const HEADER_HEIGHT = 60;
  const TIME_AXIS_WIDTH = 35;
  const dayColumnWidth = (screenWidth - TIME_AXIS_WIDTH - 32) / 7; // 32 for horizontal padding
  const gridHeight = (endHour - startHour) * HOUR_HEIGHT;

  const timeSlots = useMemo(() =>
    Array.from(
      { length: Math.max(0, Math.floor(endHour) - Math.ceil(startHour) + 1) },
      (_, i) => Math.ceil(startHour) + i,
    ),
    [endHour, startHour]
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
    },
    titleContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
      paddingHorizontal: 16,
      paddingTop: 64,
      backgroundColor: "transparent",
    },
    titleTextContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    dateNavigator: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingBottom: 10,
    },
    dateText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: Colors[colorScheme].text,
    },
    scheduleContainer: {
      flexDirection: 'row',
      flex: 1,
      overflow: 'visible',
      paddingBottom: 12,
    },
    timeAxis: {
      width: TIME_AXIS_WIDTH,
      alignItems: 'center',
    },
    timeText: {
      fontSize: 10,
      textAlign: 'center',
    },
    timeLabel: {
      height: 20,
      justifyContent: 'center',
      position: 'absolute',
      left: 0,
      right: 0,
    },
    schedule: {
      flex: 1,
      flexDirection: 'row',
      position: 'relative',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors[colorScheme].separator,
      overflow: 'hidden',
      backgroundColor: Colors[colorScheme].card,
    },
    dayColumn: {
      width: dayColumnWidth,
    },
    dayColumnHeader: {
      alignItems: 'center',
      height: HEADER_HEIGHT,
      borderBottomWidth: 0, // Remove hard border
      backgroundColor: 'transparent',
      paddingTop: 12,
      justifyContent: 'flex-start',
    },
    dayInitialText: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    dateNumberText: {
      fontSize: 12,
    },
    dayColumnContent: {
      flex: 1,
      position: 'relative',
    },
    gridLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle grid lines
    },
    gridVertical: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    classBlock: {
      position: 'absolute',
      left: 3,
      right: 3,
      borderRadius: 10, // Softer class block corners
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    verticalTextContainer: {
      position: 'absolute',
      transform: [{ rotate: '90deg' }],
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    presentBlock: {
      // styles handled in DayColumn for visibility
    },
    absentBlock: {
      // styles handled in DayColumn for visibility
    },
    cancelledBlock: {
      opacity: 0.4,
      backgroundColor: Colors[colorScheme].border,
    },
    unmarkedBlock: {
      opacity: 0.8,
    },
    courseCode: {
      fontSize: 12,
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
      flexShrink: 1,
    },
    holidayBlock: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
    },
    holidayText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
      transform: [{ rotate: '90deg' }],
      flexShrink: 1,
    },
    manageHolidaysButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors[colorScheme].cardBackground,
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      backgroundColor: Colors[colorScheme].card,
      borderRadius: 16,
      marginHorizontal: 16,
      marginTop: 20,
    },
    emptyStateText: {
      textAlign: 'center',
      opacity: 0.6,
      fontSize: 16,
    },
    currentTimeIndicator: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: '#FF3B30',
      zIndex: 10,
    },
  }), [colorScheme, dayColumnWidth]);

  const getBlockStyle = useCallback((classItem: ClassItem, date: Date) => {
    const courseColor = courseColors[classItem.course.id] || Colors[colorScheme].card;

    // 1) always include the “base” block style + your dynamic bgColor
    const base: StyleProp<ViewStyle> = [
      styles.classBlock,
      { backgroundColor: courseColor },
    ];

    if (isDateInPast(date)) {
      switch (classItem.attendance?.status) {
        case 'present':
          return StyleSheet.flatten([base, styles.presentBlock]);
        case 'absent':
          return StyleSheet.flatten([base, styles.absentBlock]);
        case 'cancelled':
          return StyleSheet.flatten([base, styles.cancelledBlock]);
        default:
          return StyleSheet.flatten([base, styles.unmarkedBlock]);
      }
    }

    return StyleSheet.flatten([base, styles.unmarkedBlock]);
  }, [courseColors, styles, colorScheme]);


  return (
    <ThemedView style={styles.container}>

      <ThemedView style={styles.titleContainer}>
        <View style={styles.titleTextContainer}>
          <ThemedText type="title">Tracker</ThemedText>
        </View>
        <Link href="/manage-holidays" asChild style={{ marginLeft: 'auto' }}>
          <TouchableOpacity style={styles.manageHolidaysButton}>
            <Ionicons name="calendar-outline" size={20} color={Colors[colorScheme].tint} />
          </TouchableOpacity>
        </Link>
      </ThemedView>

      <View style={styles.dateNavigator}>

        <TouchableOpacity onPress={handlePrevWeek} disabled={loading}>
          <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowDatePicker(true)}>
          <ThemedText style={styles.dateText}>
            {format(getWeekStartDate(startDate, weekStartsOn), 'MMM d')} - {format(getWeekEndDate(startDate, weekStartsOn), 'MMM d, yyyy')}
          </ThemedText>

        </TouchableOpacity>
        <TouchableOpacity onPress={handleNextWeek} disabled={loading}>
          <Ionicons name="chevron-forward" size={24} color={Colors[colorScheme].text} />
        </TouchableOpacity>

      </View>
      {showDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
      {loading && <ActivityIndicator size="large" color={Colors[colorScheme].tint} style={{ marginVertical: 20 }} />}
      {error && <ThemedText style={{ color: Colors[colorScheme].error, textAlign: 'center', marginVertical: 20 }}>{error}</ThemedText>}
      {!loading && !error && !hasClasses && (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="calendar-outline" size={48} color={Colors[colorScheme].textSecondary} style={{ marginBottom: 12 }} />
          <ThemedText style={styles.emptyStateText}>No classes scheduled this week.</ThemedText>
        </View>
      )}
      {!loading && !error && hasClasses && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View style={styles.scheduleContainer}>
              <TimeAxis timeSlots={timeSlots} styles={{ ...styles, startHour, gridHeight }} is24Hour={is24Hour} />
              <View style={styles.schedule}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  {Array.from({ length: 6 }, (_, index) => (
                    <View
                      key={`day-divider-${index}`}
                      style={[styles.gridVertical, { left: `${((index + 1) / 7) * 100}%` }]}
                    />
                  ))}
                  <View style={[styles.gridLine, { top: HEADER_HEIGHT }]} />
                  {timeSlots.map(hour => (
                    <View
                      key={hour}
                      style={[styles.gridLine, { top: HEADER_HEIGHT + (hour - startHour) * HOUR_HEIGHT }]}
                    />
                  ))}
                  <View style={[styles.gridLine, { top: HEADER_HEIGHT + gridHeight - 1 }]} />
                </View>
                {Object.keys(classes).map(dateString => (
                  <DayColumn
                    key={dateString}
                    dateString={dateString}
                    classes={classes[dateString]}
                    startHour={startHour}
                    styles={{ ...styles, startHour, endHour, gridHeight }}
                    getBlockStyle={getBlockStyle}
                    handleSelectClass={handleSelectClass}
                    handleLongPressClass={(classItem) => router.push(`/course/${classItem.course.id}`)}
                    courseColors={courseColors}
                    weekStartsOn={weekStartsOn}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </ThemedView>
  );
}
