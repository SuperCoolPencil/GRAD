import React, { useCallback, useMemo, useState, useContext } from 'react';
import { View, StyleSheet, useColorScheme, TouchableOpacity, ScrollView, TextInput, SafeAreaView } from 'react-native';
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
import { calculateTargetDate } from '../utils/attendance';

type TabType = 'holidays' | 'skipDays';

const ManageHolidaysScreen: React.FC = () => {
  const { holidays, addHoliday, deleteHoliday, skipDays, addSkipDay, deleteSkipDay, courses } = useContext(AppContext);
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
  const [skipEndDate, setSkipEndDate] = useState<Date>(() => new Date());
  const [skipReason, setSkipReason] = useState<string>('');
  const [showSkipDatePicker, setShowSkipDatePicker] = useState<boolean>(false);
  const [showSkipEndDatePicker, setShowSkipEndDatePicker] = useState<boolean>(false);

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
    setSkipEndDate(new Date());
    setSkipReason('');
  }, []);

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

    showAlert(
      'Add Holiday?',
      `Do you want to add "${newHoliday.name}" from ${newHoliday.startDate} to ${newHoliday.endDate}? No attendance records will be created for classes during this period.`,
      [
        {
          text: 'Add Holiday',
          onPress: () => {
            addHoliday(newHoliday);
            resetForm();
          }
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [name, startDate, endDate, addHoliday, resetForm, showAlert]);

  const handleAddSkipDay = useCallback(() => {
    const skipDateISO = formatDateToISO(skipDate);
    const skipEndDateISO = formatDateToISO(skipEndDate);
    const todayISO = formatDateToISO(new Date());

    if (skipEndDateISO < skipDateISO) {
      showAlert('Error', 'End date cannot be before start date.');
      return;
    }

    if (skipDateISO < todayISO) {
      showAlert('Error', 'Skip date cannot be in the past.');
      return;
    }

    const newSkipDay: SkipDay = {
      id: Date.now().toString(),
      date: skipDateISO,
      endDate: skipEndDateISO,
      reason: skipReason.trim() || undefined,
    };

    addSkipDay(newSkipDay);
    resetSkipDayForm();
  }, [skipDate, skipEndDate, skipReason, addSkipDay, resetSkipDayForm, showAlert]);

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
        ? `Target by: ${maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
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
    <View style={[styles.listItem, !showDelete && styles.historyListItem]}>
      <View style={styles.listItemIcon}>
        <Ionicons name="calendar" size={20} color={Colors[colorScheme].tint} />
      </View>
      <View style={styles.listItemContent}>
        <ThemedText style={styles.listItemTitle}>{item.name}</ThemedText>
        <ThemedText style={styles.listItemSubtitle}>
          {parseISOToDate(item.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {parseISOToDate(item.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </ThemedText>
      </View>
      {showDelete && (
        <TouchableOpacity onPress={() => deleteHoliday(item.id)} style={styles.deleteButton}>
          <Ionicons name="close-circle" size={22} color={Colors[colorScheme].error} />
        </TouchableOpacity>
      )}
    </View>
  );

  // Skip Day Item Component
  const SkipDayItem = ({ item, showDelete = true }: { item: SkipDay; showDelete?: boolean }) => {
    const course = item.courseId ? courses.find(c => c.id === item.courseId) : null;
    const startDateStr = parseISOToDate(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDateStr = item.endDate && item.endDate !== item.date
      ? parseISOToDate(item.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null;
    const dateText = endDateStr ? `${startDateStr} - ${endDateStr}` : startDateStr;
    const timeText = item.timeStart && item.timeEnd ? ` · ${item.timeStart}-${item.timeEnd}` : '';
    const courseText = course ? ` · ${course.name}` : '';

    return (
      <View style={[styles.listItem, !showDelete && styles.historyListItem]}>
        <View style={styles.listItemIcon}>
          <Ionicons name="close-circle" size={20} color={Colors[colorScheme].error} />
        </View>
        <View style={styles.listItemContent}>
          <ThemedText style={styles.listItemTitle}>
            {dateText}{courseText}{timeText}
          </ThemedText>
          {item.reason && (
            <ThemedText style={styles.listItemSubtitle}>{item.reason}</ThemedText>
          )}
        </View>
        {showDelete && (
          <TouchableOpacity onPress={() => deleteSkipDay(item.id)} style={styles.deleteButton}>
            <Ionicons name="close-circle" size={22} color={Colors[colorScheme].error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Collapsible Section Header
  const CollapsibleHeader = ({ title, count, isOpen, onToggle }: { title: string; count: number; isOpen: boolean; onToggle: () => void }) => (
    <TouchableOpacity style={styles.collapsibleHeader} onPress={onToggle}>
      <View style={styles.collapsibleLabel}>
        <Ionicons name="time-outline" size={18} color={Colors[colorScheme].icon} />
        <ThemedText style={styles.collapsibleTitle}>{title}</ThemedText>
        <View style={styles.countPill}><ThemedText style={styles.countText}>{count}</ThemedText></View>
      </View>
      <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={Colors[colorScheme].icon} />
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <CustomHeader title="Manage Time Off" />

        <View style={styles.pageIntro}>
          <View style={styles.pageIntroIcon}>
            <Ionicons name="calendar-clear-outline" size={21} color={Colors[colorScheme].tint} />
          </View>
          <View style={styles.pageIntroCopy}>
            <ThemedText style={styles.pageIntroTitle}>Plan around your schedule</ThemedText>
            <ThemedText style={styles.pageIntroText}>Holidays pause classes. Skip days show how planned absences affect your target.</ThemedText>
          </View>
        </View>

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
                <ThemedText style={styles.cardDescription}>
                  No classes happen on holidays. They don't affect your attendance percentage.
                </ThemedText>

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
                      <ThemedText style={styles.dateButtonText}>{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</ThemedText>
                    </TouchableOpacity>
                    {showStartDatePicker && (
                      <DateTimePicker
                        value={startDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowStartDatePicker(false);
                          if (selectedDate) {
                            setStartDate(selectedDate);
                            setEndDate(selectedDate); // Auto-set end date to start date
                          }
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
                      <ThemedText style={styles.dateButtonText}>{endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</ThemedText>
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
                <View style={styles.historyGroup}>
                  <CollapsibleHeader
                    title="Past Holidays"
                    count={pastHolidays.length}
                    isOpen={showPastHolidays}
                    onToggle={() => setShowPastHolidays(!showPastHolidays)}
                  />
                  {showPastHolidays && <View style={styles.historyList}>{pastHolidays.map(item => <HolidayItem key={item.id} item={item} showDelete={false} />)}</View>}
                </View>
              )}
            </>
          )}

          {/* Skip Days Tab */}
          {activeTab === 'skipDays' && (
            <>
              {/* Target Date Card */}
              {maxTargetDateInfo && (
                <View style={styles.statusCard}>
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
                  Planned absences that will count against your attendance. Use this to see when you'll reach your target if you skip class.
                </ThemedText>

                <View style={styles.dateRow}>
                  <View style={styles.dateField}>
                    <ThemedText style={styles.dateLabel}>Start</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowSkipDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={16} color={Colors[colorScheme].icon} />
                      <ThemedText style={styles.dateButtonText}>{skipDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</ThemedText>
                    </TouchableOpacity>
                    {showSkipDatePicker && (
                      <DateTimePicker
                        value={skipDate}
                        mode="date"
                        display="default"
                        minimumDate={new Date()}
                        onChange={(event, selectedDate) => {
                          setShowSkipDatePicker(false);
                          if (selectedDate) {
                            setSkipDate(selectedDate);
                            setSkipEndDate(selectedDate);
                          }
                        }}
                      />
                    )}
                  </View>

                  <View style={styles.dateArrow}>
                    <Ionicons name="arrow-forward" size={20} color={Colors[colorScheme].icon} />
                  </View>

                  <View style={styles.dateField}>
                    <ThemedText style={styles.dateLabel}>End</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowSkipEndDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={16} color={Colors[colorScheme].icon} />
                      <ThemedText style={styles.dateButtonText}>{skipEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</ThemedText>
                    </TouchableOpacity>
                    {showSkipEndDatePicker && (
                      <DateTimePicker
                        value={skipEndDate}
                        mode="date"
                        display="default"
                        minimumDate={skipDate}
                        onChange={(event, selectedDate) => {
                          setShowSkipEndDatePicker(false);
                          if (selectedDate) setSkipEndDate(selectedDate);
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
                <View style={styles.historyGroup}>
                  <CollapsibleHeader
                    title="Past Skip Days"
                    count={pastSkipDays.length}
                    isOpen={showPastSkipDays}
                    onToggle={() => setShowPastSkipDays(!showPastSkipDays)}
                  />
                  {showPastSkipDays && <View style={styles.historyList}>{pastSkipDays.map(item => <SkipDayItem key={item.id} item={item} showDelete={false} />)}</View>}
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
      paddingTop: 4,
    },
    pageIntro: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 8,
      padding: 16,
      borderRadius: 16,
      backgroundColor: Colors[colorScheme].card,
      gap: 12,
    },
    pageIntroIcon: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(1,150,255,0.08)',
    },
    pageIntroCopy: { flex: 1 },
    pageIntroTitle: { fontSize: 16, fontWeight: '700', color: Colors[colorScheme].text },
    pageIntroText: { fontSize: 13, lineHeight: 18, marginTop: 3, color: Colors[colorScheme].textSecondary },

    // Tab Bar
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 8,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 13,
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(1,150,255,0.07)',
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
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 8,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors[colorScheme].text,
    },
    cardDescription: {
      fontSize: 14,
      color: Colors[colorScheme].icon,
      marginBottom: 18,
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
      gap: 12,
    },
    statusContent: {
      flex: 1,
    },
    statusTitle: {
      fontSize: 15,
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
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(1,150,255,0.07)',
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 14,
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
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(1,150,255,0.07)',
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 8,
    },
    dateButtonText: {
      fontSize: 14,
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
      fontSize: 15,
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
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: Colors[colorScheme].textSecondary,
    },

    // List Items
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors[colorScheme].card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
    },
    listItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(1,150,255,0.07)',
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
    historyGroup: {
      backgroundColor: Colors[colorScheme].card,
      borderRadius: 16,
      marginBottom: 20,
      overflow: 'hidden',
    },
    historyList: {
      paddingHorizontal: 14,
      paddingBottom: 4,
    },
    historyListItem: {
      marginBottom: 0,
      paddingHorizontal: 0,
      borderRadius: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors[colorScheme].separator,
      backgroundColor: 'transparent',
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
      paddingVertical: 15,
      paddingHorizontal: 14,
    },
    collapsibleLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    collapsibleTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors[colorScheme].text,
    },
    countPill: {
      minWidth: 22,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(1,150,255,0.08)',
    },
    countText: { textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors[colorScheme].tint },
  });

export default ManageHolidaysScreen;
