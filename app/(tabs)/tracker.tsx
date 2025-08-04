import React, { useState, useCallback, useMemo, useContext } from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme, useWindowDimensions, ScrollView, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { AppContext } from '@/context/AppContext';
import { format } from 'date-fns';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getWeekStartDate, getWeekEndDate, addDaysToDate, subDaysFromDate, isDateInPast, parseISOToDate } from '@/utils/dateHelpers';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAttendanceData, ClassItem } from '@/hooks/useAttendanceData';
import { useAttendanceActions } from '@/hooks/useAttendanceActions';
import TimeAxis from '@/components/AttendanceTracker/TimeAxis';
import DayColumn from '@/components/AttendanceTracker/DayColumn';

export default function VisualAttendanceTracker() {
  const { is24Hour } = useContext(AppContext);
  const colorScheme = useColorScheme() ?? 'light';
  const [startDate, setStartDate] = useState(subDaysFromDate(new Date(), 3));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const { classes, courseColors, startHour, endHour, loading, error } = useAttendanceData(startDate, true);
  const { handleSelectClass } = useAttendanceActions();

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setStartDate(subDaysFromDate(selectedDate, 3));
    }
  };

  const handlePrevDay = () => {
    setStartDate(prevDate => subDaysFromDate(prevDate, 1));
  };

  const handleNextDay = () => {
    setStartDate(prevDate => addDaysToDate(prevDate, 1));
  };

  const HOUR_HEIGHT = 60;
  const hourCount = Math.ceil(endHour) - startHour;
  const scheduleHeight = hourCount * HOUR_HEIGHT;
  const dayColumnWidth = (screenWidth - 70) / 7;

  const timeSlots = useMemo(() => 
    Array.from({ length: hourCount + 1}, (_, i) => i + startHour),
    [hourCount, startHour]
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
      marginTop: 50,
    },
    timeAxis: {
      width: 50,
      alignItems: 'center',
      paddingBottom: 12,
    },
    timeText: {
      fontSize: 10,
      textAlign: 'center',
    },
    timeLabel: {
      height: HOUR_HEIGHT,
      justifyContent: 'flex-start',
    },
    timeLabelContainer: {
      height: 20,
      justifyContent: 'center',
      marginTop: -10,
    },
    schedule: {
      flex: 1,
      flexDirection: 'row',
      position: 'relative',
      borderRightWidth: 1,
      borderRightColor: Colors[colorScheme].border,
      borderBottomWidth: 1,
      borderBottomColor: Colors[colorScheme].border,
      backgroundColor: Colors[colorScheme].card,
    },
    dayColumn: {
      width: dayColumnWidth,
      borderLeftWidth: 1,
      borderLeftColor: Colors[colorScheme].border,
      overflow: 'visible',
    },
    dayColumnHeader: {
      alignItems: 'center',
      paddingVertical: 5,
      height: 50,
      position: 'absolute',
      top: -50,
      left: 0,
      right: 0,
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
      backgroundColor: Colors[colorScheme].border,
    },
    classBlock: {
      position: 'absolute',
      left: 4,
      right: 4,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    verticalTextContainer: {
      position: 'absolute',
      transform: [{ rotate: '-90deg' }],
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    presentBlock: {
      borderColor: Colors[colorScheme].success,
      borderWidth: 3,
    },
    absentBlock: {
      borderColor: Colors[colorScheme].error,
      borderWidth: 3,
      borderStyle: 'dashed',
    },
    cancelledBlock: {
      opacity: 0.5,
      backgroundColor: Colors[colorScheme].border,
    },
    unmarkedBlock: {
      opacity: 0.7,
    },
    courseCode: {
      fontSize: 12,
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
      flexShrink: 1,
    },
  }), [colorScheme, scheduleHeight, hourCount, dayColumnWidth]);

  const getBlockStyle = useCallback((classItem: ClassItem, date: Date) => {
    const courseColor = courseColors[classItem.course.id] || Colors[colorScheme].card;

    // 1) always include the “base” block style + your dynamic bgColor
    const base: StyleProp<ViewStyle> = [
      styles.classBlock,
      { backgroundColor: courseColor },
    ];

    if (isDateInPast(date)) {
      switch(classItem.attendance?.status) {
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
        <ThemedText type="title">Tracker</ThemedText>
      </ThemedView>
      
      <View style={styles.dateNavigator}>

        <TouchableOpacity onPress={handlePrevDay} disabled={loading}>
          <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowDatePicker(true)}>
          <ThemedText style={styles.dateText}>
            {format(addDaysToDate(startDate, 3), 'MMMM d, yyyy')}
          </ThemedText>

        </TouchableOpacity>
        <TouchableOpacity onPress={handleNextDay} disabled={loading}>
          <Ionicons name="chevron-forward" size={24} color={Colors[colorScheme].text} />
        </TouchableOpacity>

      </View>
      {showDatePicker && (
        <DateTimePicker
          value={addDaysToDate(startDate, 3)}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
      {loading && <ActivityIndicator size="large" color={Colors[colorScheme].tint} style={{ marginVertical: 20 }} />}
        {error && <ThemedText style={{ color: Colors[colorScheme].error, textAlign: 'center', marginVertical: 20 }}>{error}</ThemedText>}
        {!loading && !error && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View style={styles.scheduleContainer}>
              <TimeAxis timeSlots={timeSlots} styles={styles} is24Hour={is24Hour} />
              <View style={styles.schedule}>
                {Object.keys(classes).map(dateString => (
                  <DayColumn
                    key={dateString}
                    dateString={dateString}
                    classes={classes[dateString]}
                    timeSlots={timeSlots}
                    startHour={startHour}
                    styles={{...styles, endHour}}
                    getBlockStyle={getBlockStyle}
                    handleSelectClass={handleSelectClass}
                    courseColors={courseColors}
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
