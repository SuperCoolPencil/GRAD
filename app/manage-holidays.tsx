import React, { useCallback, useMemo, useState, useContext } from 'react';
import { View, StyleSheet, useColorScheme, TouchableOpacity, ScrollView, FlatList, TextInput, SafeAreaView, Animated } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '../context/AppContext';
import { Holiday, SkipDay } from '../types';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import CustomHeader from '../components/CustomHeader';
import { formatDateToISO, parseISOToDate } from '../utils/dateHelpers';
import { Colors } from '../constants/Colors';
import { useTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomAlert } from '../context/AlertContext';
import { getSetting } from '../utils/database';
import { calculateTargetDate } from '../utils/attendance';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type TabType = 'holidays' | 'skipDays';

const ManageHolidaysScreen: React.FC = () => {
  const { holidays, addHoliday, deleteHoliday, skipDays, addSkipDay, deleteSkipDay, upsertAttendance, courses, triggerRefresh } = useContext(AppContext);
  const { showAlert } = useCustomAlert();
  const colorScheme = useColorScheme() ?? 'light';
  const { colors } = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('holidays');

  // Holiday form state
  const [name, setName] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(() => new Date());
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState<boolean>(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState<boolean>(false);

  // Skip day form state
  const [skipDate, setSkipDate] = useState<Date>(() => new Date());
  const [skipReason, setSkipReason] = useState<string>('');
  const [showSkipDatePicker, setShowSkipDatePicker] = useState<boolean>(false);

  // Collapsible state
  const [showPastHolidays, setShowPastHolidays] = useState<boolean>(false);
  const [showPastSkipDays, setShowPastSkipDays] = useState<boolean>(false);

  const styles = useMemo(() => getStyles(colorScheme, colors), [colorScheme, colors]);

  const resetForm = useCallback(() => {
    setName('');
    setStartDate(new Date());
    setEndDate(new Date());
  }, []);

  const resetSkipDayForm = useCallback(() => {
    setSkipDate(new Date());
    setSkipReason('');
  }, []);

  const markHolidayAttendance = useCallback((holiday: Holiday, status: 'cancelled' | 'skipped') => {
    if (status === 'skipped') {
      console.log(`[HOLIDAY] Skipping marking attendance for holiday: ${holiday.name}`);
      triggerRefresh();
      return;
    }

    const start = parseISOToDate(holiday.startDate);
    const end = parseISOToDate(holiday.endDate);
    let current = new Date(start.getTime());

    while (current <= end) {
      const dateString = formatDateToISO(current);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][current.getDay()];

      courses.forEach(course => {
        if (course.isArchived) return;

        course.weeklySchedule?.forEach(schedule => {
          if (schedule.day === dayName) {
            upsertAttendance(course.id, schedule.id, 'cancelled', false, schedule.timeStart, schedule.timeEnd, dateString);
          }
        });

        course.extraClasses?.forEach(extraClass => {
          if (extraClass.date === dateString) {
            upsertAttendance(course.id, extraClass.id, 'cancelled', true, extraClass.timeStart, extraClass.timeEnd, dateString);
          }
        });
      });

      current = new Date(current.getTime() + MS_PER_DAY);
    }

    triggerRefresh();
  }, [courses, upsertAttendance, triggerRefresh]);

  const handleAddHoliday = useCallback(() => {
    if (name.trim() === '') {
      showAlert('Error', 'Holiday name cannot be empty.');
      return;
    }

    if (endDate < startDate) {
      showAlert('Error', 'End date cannot be before start date.');
      return;
    }

    const newHoliday: Holiday = {
      id: Date.now().toString(),
      name: name.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '),
      startDate: formatDateToISO(startDate),
      endDate: formatDateToISO(endDate),
    };

    const todayISO = new Date().toISOString().split('T')[0];
    const holidayBehaviorSetting = (getSetting('holidayBehavior') as string) || 'skip';

    let actionStatus: 'cancelled' | 'skipped';
    let actionText: string;
    let message: string;

    if (newHoliday.startDate <= todayISO) {
      actionStatus = 'cancelled';
      actionText = 'Mark as Cancelled';
      message = `The holiday starts in the past. Do you want to mark ${newHoliday.startDate} to ${newHoliday.endDate} as holiday? All classes will be marked as \"Cancelled\".`;
    } else {
      actionStatus = holidayBehaviorSetting as 'cancelled' | 'skipped';
      actionText = holidayBehaviorSetting === 'skip' ? 'Skip Marking' : 'Mark as Cancelled';
      message = holidayBehaviorSetting === 'skip'
        ? `Do you want to skip marking classes for ${newHoliday.startDate} to ${newHoliday.endDate}? No attendance records will be created for this period.`
        : `Do you want to mark ${newHoliday.startDate} to ${newHoliday.endDate} as holiday? All classes will be marked as \"Cancelled\".`;
    }

    showAlert(
      'Mark Holiday?',
      message,
      [
        {
          text: actionText,
          onPress: () => {
            addHoliday(newHoliday);
            markHolidayAttendance(newHoliday, actionStatus);
            resetForm();
          }
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [name, startDate, endDate, addHoliday, resetForm, showAlert, markHolidayAttendance]);

  const handleAddSkipDay = useCallback(() => {
    const skipDateISO = formatDateToISO(skipDate);
    const todayISO = formatDateToISO(new Date());

    if (skipDateISO < todayISO) {
      showAlert('Error', 'Skip date cannot be in the past.');
      return;
    }

    if (skipDays.some(s => s.date === skipDateISO)) {
      showAlert('Error', 'A skip day already exists for this date.');
      return;
    }

    const newSkipDay: SkipDay = {
      id: Date.now().toString(),
      date: skipDateISO,
      reason: skipReason.trim() || undefined,
    };

    addSkipDay(newSkipDay);
    resetSkipDayForm();
  }, [skipDate, skipReason, skipDays, addSkipDay, resetSkipDayForm, showAlert]);

  const upcomingHolidays = holidays.filter((h: Holiday) => new Date(h.endDate) >= new Date());
  const pastHolidays = holidays.filter((h: Holiday) => new Date(h.endDate) < new Date());
  const upcomingSkipDays = skipDays.filter((s: SkipDay) => new Date(s.date) >= new Date());
  const pastSkipDays = skipDays.filter((s: SkipDay) => new Date(s.date) < new Date());

  // Calculate maximum target date across all non-archived courses
  const maxTargetDateInfo = useMemo(() => {
    const activeCourses = courses.filter(c => !c.isArchived);
    if (activeCourses.length === 0) return null;

    let maxDate: Date | null = null;
    let maxClassesNeeded = 0;
    let courseName = '';

    for (const course of activeCourses) {
      const result = calculateTargetDate(course, holidays, skipDays);
      if (result.targetDate) {
        if (!maxDate || result.targetDate > maxDate) {
          maxDate = result.targetDate;
          maxClassesNeeded = result.classesNeeded;
          courseName = course.name;
        }
      } else if (result.classesNeeded > 0 && result.classesNeeded > maxClassesNeeded) {
        maxClassesNeeded = result.classesNeeded;
        courseName = course.name;
      }
    }

    if (!maxDate && maxClassesNeeded === 0) {
      return { message: 'All courses meeting target!', date: null, courseName: '', status: 'success' as const };
    }

    return {
      date: maxDate,
      classesNeeded: maxClassesNeeded,
      courseName,
      message: maxDate
        ? `Target by: ${maxDate.toLocaleDateString()}`
        : `${courseName} needs ${maxClassesNeeded} classes`,
      status: maxDate ? 'warning' as const : 'error' as const
    };
  }, [courses, holidays, skipDays]);

  const getStatusColor = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success': return Colors[colorScheme].success;
      case 'warning': return Colors[colorScheme].warning || '#f59e0b';
      case 'error': return Colors[colorScheme].error;
    }
  };

  // Tab Button Component
  const TabButton = ({ tab, label, icon }: { tab: TabType; label: string; icon: string }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tab && styles.tabButtonActive
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={activeTab === tab ? '#fff' : Colors[colorScheme].text}
        style={{ marginRight: 6 }}
      />
      <ThemedText style={[
        styles.tabButtonText,
        activeTab === tab && styles.tabButtonTextActive
      ]}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );

  // Empty State Component
  const EmptyState = ({ icon, message }: { icon: string; message: string }) => (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={48} color={Colors[colorScheme].icon} />
      <ThemedText style={styles.emptyStateText}>{message}</ThemedText>
    </View>
  );

  // Holiday Item Component
  const HolidayItem = ({ item, showDelete = true }: { item: Holiday; showDelete?: boolean }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemIcon}>
        <Ionicons name="calendar" size={20} color={Colors[colorScheme].tint} />
      </View>
      <View style={styles.listItemContent}>
        <ThemedText style={styles.listItemTitle}>{item.name}</ThemedText>
        <ThemedText style={styles.listItemSubtitle}>
          {parseISOToDate(item.startDate).toLocaleDateString()} - {parseISOToDate(item.endDate).toLocaleDateString()}
        </ThemedText>
      </View>
      {showDelete && (
        <TouchableOpacity onPress={() => deleteHoliday(item.id)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color={Colors[colorScheme].error} />
        </TouchableOpacity>
      )}
    </View>
  );

  // Skip Day Item Component
  const SkipDayItem = ({ item, showDelete = true }: { item: SkipDay; showDelete?: boolean }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemIcon}>
        <Ionicons name="close-circle" size={20} color={Colors[colorScheme].error} />
      </View>
      <View style={styles.listItemContent}>
        <ThemedText style={styles.listItemTitle}>
          {parseISOToDate(item.date).toLocaleDateString()}
        </ThemedText>
        {item.reason && (
          <ThemedText style={styles.listItemSubtitle}>{item.reason}</ThemedText>
        )}
      </View>
      {showDelete && (
        <TouchableOpacity onPress={() => deleteSkipDay(item.id)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color={Colors[colorScheme].error} />
        </TouchableOpacity>
      )}
    </View>
  );

  // Collapsible Section Header
  const CollapsibleHeader = ({ title, count, isOpen, onToggle }: { title: string; count: number; isOpen: boolean; onToggle: () => void }) => (
    <TouchableOpacity style={styles.collapsibleHeader} onPress={onToggle}>
      <ThemedText style={styles.collapsibleTitle}>{title} ({count})</ThemedText>
      <Ionicons
        name={isOpen ? "chevron-up" : "chevron-down"}
        size={20}
        color={Colors[colorScheme].icon}
      />
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <CustomHeader title="Manage Time Off" />

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TabButton tab="holidays" label="Holidays" icon="calendar-outline" />
          <TabButton tab="skipDays" label="Skip Days" icon="today-outline" />
        </View>

        <ScrollView style={styles.contentContainer} keyboardShouldPersistTaps="handled">

          {/* Holidays Tab */}
          {activeTab === 'holidays' && (
            <>
              {/* Add Holiday Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="add-circle" size={22} color={Colors[colorScheme].tint} />
                  <ThemedText style={styles.cardTitle}>Add Holiday</ThemedText>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Holiday name (e.g. Summer Break)"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor={Colors[colorScheme].icon}
                />

                <View style={styles.dateRow}>
                  <View style={styles.dateField}>
                    <ThemedText style={styles.dateLabel}>Start</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={16} color={Colors[colorScheme].icon} />
                      <ThemedText style={styles.dateButtonText}>{startDate.toLocaleDateString()}</ThemedText>
                    </TouchableOpacity>
                    {showStartDatePicker && (
                      <DateTimePicker
                        value={startDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowStartDatePicker(false);
                          if (selectedDate) setStartDate(selectedDate);
                        }}
                      />
                    )}
                  </View>

                  <View style={styles.dateArrow}>
                    <Ionicons name="arrow-forward" size={20} color={Colors[colorScheme].icon} />
                  </View>

                  <View style={styles.dateField}>
                    <ThemedText style={styles.dateLabel}>End</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={16} color={Colors[colorScheme].icon} />
                      <ThemedText style={styles.dateButtonText}>{endDate.toLocaleDateString()}</ThemedText>
                    </TouchableOpacity>
                    {showEndDatePicker && (
                      <DateTimePicker
                        value={endDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowEndDatePicker(false);
                          if (selectedDate) setEndDate(selectedDate);
                        }}
                      />
                    )}
                  </View>
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={handleAddHoliday}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <ThemedText style={styles.primaryButtonText}>Add Holiday</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Upcoming Holidays */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="time-outline" size={20} color={Colors[colorScheme].tint} />
                  <ThemedText style={styles.sectionTitle}>Upcoming</ThemedText>
                </View>
                {upcomingHolidays.length > 0 ? (
                  upcomingHolidays.map(item => <HolidayItem key={item.id} item={item} />)
                ) : (
                  <EmptyState icon="calendar-clear-outline" message="No upcoming holidays" />
                )}
              </View>

              {/* Past Holidays (Collapsible) */}
              {pastHolidays.length > 0 && (
                <View style={styles.section}>
                  <CollapsibleHeader
                    title="Past Holidays"
                    count={pastHolidays.length}
                    isOpen={showPastHolidays}
                    onToggle={() => setShowPastHolidays(!showPastHolidays)}
                  />
                  {showPastHolidays && pastHolidays.map(item => (
                    <HolidayItem key={item.id} item={item} showDelete={false} />
                  ))}
                </View>
              )}
            </>
          )}

          {/* Skip Days Tab */}
          {activeTab === 'skipDays' && (
            <>
              {/* Target Date Card */}
              {maxTargetDateInfo && (
                <View style={[styles.statusCard, { borderLeftColor: getStatusColor(maxTargetDateInfo.status) }]}>
                  <Ionicons
                    name={maxTargetDateInfo.status === 'success' ? "checkmark-circle" : "alert-circle"}
                    size={24}
                    color={getStatusColor(maxTargetDateInfo.status)}
                  />
                  <View style={styles.statusContent}>
                    <ThemedText style={styles.statusTitle}>{maxTargetDateInfo.message}</ThemedText>
                    {maxTargetDateInfo.courseName && maxTargetDateInfo.date && (
                      <ThemedText style={styles.statusSubtitle}>{maxTargetDateInfo.courseName}</ThemedText>
                    )}
                  </View>
                </View>
              )}

              {/* Add Skip Day Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="add-circle" size={22} color={Colors[colorScheme].tint} />
                  <ThemedText style={styles.cardTitle}>Add Skip Day</ThemedText>
                </View>
                <ThemedText style={styles.cardDescription}>
                  Mark days you plan to be absent. This helps calculate your target attendance date.
                </ThemedText>

                <View style={styles.dateRow}>
                  <View style={[styles.dateField, { flex: 1 }]}>
                    <ThemedText style={styles.dateLabel}>Date</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowSkipDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={16} color={Colors[colorScheme].icon} />
                      <ThemedText style={styles.dateButtonText}>{skipDate.toLocaleDateString()}</ThemedText>
                    </TouchableOpacity>
                    {showSkipDatePicker && (
                      <DateTimePicker
                        value={skipDate}
                        mode="date"
                        display="default"
                        minimumDate={new Date()}
                        onChange={(event, selectedDate) => {
                          setShowSkipDatePicker(false);
                          if (selectedDate) setSkipDate(selectedDate);
                        }}
                      />
                    )}
                  </View>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Reason (optional)"
                  value={skipReason}
                  onChangeText={setSkipReason}
                  placeholderTextColor={Colors[colorScheme].icon}
                />

                <TouchableOpacity style={styles.primaryButton} onPress={handleAddSkipDay}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <ThemedText style={styles.primaryButtonText}>Add Skip Day</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Upcoming Skip Days */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="time-outline" size={20} color={Colors[colorScheme].tint} />
                  <ThemedText style={styles.sectionTitle}>Upcoming</ThemedText>
                </View>
                {upcomingSkipDays.length > 0 ? (
                  upcomingSkipDays.map(item => <SkipDayItem key={item.id} item={item} />)
                ) : (
                  <EmptyState icon="checkmark-circle-outline" message="No skip days planned" />
                )}
              </View>

              {/* Past Skip Days (Collapsible) */}
              {pastSkipDays.length > 0 && (
                <View style={styles.section}>
                  <CollapsibleHeader
                    title="Past Skip Days"
                    count={pastSkipDays.length}
                    isOpen={showPastSkipDays}
                    onToggle={() => setShowPastSkipDays(!showPastSkipDays)}
                  />
                  {showPastSkipDays && pastSkipDays.map(item => (
                    <SkipDayItem key={item.id} item={item} showDelete={false} />
                  ))}
                </View>
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark', colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      flex: 1,
      padding: 16,
    },

    // Tab Bar
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: Colors[colorScheme].card,
    },
    tabButtonActive: {
      backgroundColor: Colors[colorScheme].tint,
    },
    tabButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors[colorScheme].text,
    },
    tabButtonTextActive: {
      color: '#fff',
    },

    // Cards
    card: {
      backgroundColor: Colors[colorScheme].card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors[colorScheme].text,
    },
    cardDescription: {
      fontSize: 14,
      color: Colors[colorScheme].icon,
      marginBottom: 16,
      lineHeight: 20,
    },

    // Status Card
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors[colorScheme].card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      gap: 12,
    },
    statusContent: {
      flex: 1,
    },
    statusTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors[colorScheme].text,
    },
    statusSubtitle: {
      fontSize: 13,
      color: Colors[colorScheme].icon,
      marginTop: 2,
    },

    // Form Elements
    input: {
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      color: Colors[colorScheme].text,
      marginBottom: 12,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 12,
      gap: 12,
    },
    dateField: {
      flex: 1,
    },
    dateLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: Colors[colorScheme].icon,
      marginBottom: 6,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 8,
    },
    dateButtonText: {
      fontSize: 15,
      color: Colors[colorScheme].text,
    },
    dateArrow: {
      paddingBottom: 12,
    },

    // Buttons
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors[colorScheme].tint,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      gap: 8,
      marginTop: 8,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },

    // Sections
    section: {
      marginBottom: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: Colors[colorScheme].text,
    },

    // List Items
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors[colorScheme].card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    listItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    listItemContent: {
      flex: 1,
    },
    listItemTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors[colorScheme].text,
    },
    listItemSubtitle: {
      fontSize: 13,
      color: Colors[colorScheme].icon,
      marginTop: 2,
    },
    deleteButton: {
      padding: 8,
    },

    // Empty State
    emptyState: {
      alignItems: 'center',
      paddingVertical: 32,
      opacity: 0.6,
    },
    emptyStateText: {
      fontSize: 14,
      color: Colors[colorScheme].icon,
      marginTop: 8,
    },

    // Collapsible
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors[colorScheme].border || 'rgba(0,0,0,0.1)',
      marginBottom: 8,
    },
    collapsibleTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: Colors[colorScheme].icon,
    },
  });

export default ManageHolidaysScreen;
