import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme as useNativeColorScheme,
  Alert,
  Pressable,
  TextInput,
  Switch,
} from 'react-native';
import { Modal } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, Link } from 'expo-router';
import AttendanceHistory from '@/components/AttendanceHistory';
import { AppContext } from '@/context/AppContext';
import { formatTime } from '@/utils/time';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course, ScheduleItem, ExtraClass, AttendanceRecord } from '@/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { useCustomAlert } from '@/context/AlertContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import CustomHeader from '@/components/CustomHeader';
import ConfigurationModal from '@/components/ConfigurationModal';

const getAttendanceDelta = (
  presents: number,
  absents: number,
  requiredAttendance: number
): number => {
  const total = presents + absents;
  const requiredFraction = requiredAttendance / 100;
  if (total === 0) {
    return 0;
  }
  const currentFraction = presents / total;
  if (currentFraction >= requiredFraction) {
    return -Math.floor(presents / requiredFraction - total);
  } else {
    return Math.ceil(
      (requiredFraction * total - presents) / (1 - requiredFraction)
    );
  }
};

const getDeltaColor = (delta: number, colorScheme: 'light' | 'dark') => {
  if (delta > 0) return Colors[colorScheme].error;
  if (delta < 0) return Colors[colorScheme].success;
  return Colors[colorScheme].tint;
};

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    courses,
    loading,
    deleteCourse,
    upsertAttendance,
    updateCourse,
    updateCourseCounts,
    archiveCourse,
    deleteExtraClass,
    is24Hour,
    getPaginatedAttendanceRecords,
    attendanceRecords,
    deleteAttendanceRecord,
    totalRecords,
    loadData,
  } = useContext(AppContext);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const colorScheme = useNativeColorScheme() ?? 'light';
  const { showAlert, hideAlert } = useCustomAlert();

  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const primaryColor = useThemeColor({}, 'alertPrimary');
  const tintColor = useThemeColor({}, 'tint');

  const [modalVisible, setModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [countType, setCountType] = useState<"presents" | "absents" | "cancelled">("presents");
  const [page, setPage] = useState(1);
  const recordsPerPage = 10;

  useEffect(() => {
    if (course) {
      getPaginatedAttendanceRecords(page, recordsPerPage, [course.id]);
    }
  }, [page, course]);

  const handleAttendanceClick = (record: AttendanceRecord) => {
    if (!course || !record) return;

    const recordDate = new Date(record.date);
    const formattedDate = recordDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    showAlert(
      'Change Attendance Status',
      `Change status for ${course.name} on ${formattedDate}.`,
      [
        {
          text: 'Present',
          onPress: () => {
            upsertAttendance(record.course_id, record.scheduleItemId || '', 'present', record.isExtraClass, record.timeStart, record.timeEnd, record.date);
            if (loadData) loadData();
          },
        },
        {
          text: 'Absent',
          onPress: () => {
            upsertAttendance(record.course_id, record.scheduleItemId || '', 'absent', record.isExtraClass, record.timeStart, record.timeEnd, record.date);
            if (loadData) loadData();
          },
        },
        {
          text: 'Cancelled',
          onPress: () => {
            upsertAttendance(record.course_id, record.scheduleItemId || '', 'cancelled', record.isExtraClass, record.timeStart, record.timeEnd, record.date);
            if (loadData) loadData();
          },
        },
        {
          text: 'Delete Record',
          style: 'destructive',
          shouldCloseAlert: false, // Prevent the first alert from closing
          onPress: async () => {
            console.log(`[COURSE ${course.id}] Deleting attendance record for ${course.name} on ${formattedDate}`);
            showAlert(
              'Confirm Delete',
              `Are you sure you want to delete this attendance record for ${course.name} on ${formattedDate}? This action cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel', onPress: hideAlert }, // Explicitly close the confirm alert
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteAttendanceRecord(record.course_id, record.date, record.timeStart, record.timeEnd, record.isExtraClass);
                    if (loadData) loadData();
                    getPaginatedAttendanceRecords(
                      page,
                      recordsPerPage,
                      [course.id],
                    );
                    hideAlert(); // Explicitly close the confirm alert after deletion
                  },
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  useEffect(() => {
    if (!loading && id) {
      const foundCourse = courses.find((c) => c.id.toLowerCase() === id.toLowerCase());
      setCourse(foundCourse || null);
    }
  }, [loading, courses, id]);

  const handleDelete = () => {
    if (!course) return;
    showAlert(
      'Delete Course',
      `Are you sure you want to delete "${course.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCourse(course.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleArchive = () => {
    if (!course) return;
    showAlert(
      'Archive Course',
      `Archived courses no longer appear in your courses list, weekly schedules, analytics page and DO NOT trigger notifications.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive', // Use destructive style for clarity
          onPress: () => {
            archiveCourse(course.id);
            router.back(); // Go back after archiving
          },
        },
      ]
    );
  };

  // Define the onClose function for the modal
  const onClose = () => {
    setModalVisible(false);
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </ThemedView>
    );
  }

  if (!course) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <ThemedText type="subtitle">Course Not Found</ThemedText>
        <ThemedText>The course with ID '{id}' could not be found.</ThemedText>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: Colors[colorScheme].tint }}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const presents = course.presents || 0;
  const absents = course.absents || 0;
  const cancelled = course.cancelled || 0;
  const attendancePercentage = course.attendancePercentage || 0;
  const requiredAttendance = course.requiredAttendance || 75;
  const delta = getAttendanceDelta(presents, absents, requiredAttendance);
  const deltaColor = getDeltaColor(delta, colorScheme);

  let attendanceNote = 'Meeting required attendance';
  if (delta > 0) {
    attendanceNote = `Need to Attend: ${delta} more class${delta === 1 ? '' : 'es'}`;
  } else if (delta < 0) {
    attendanceNote = `Can Bunk: ${Math.abs(delta)} class${Math.abs(delta) === 1 ? '' : 'es'}`;
  }

  return (
    <>
      <CustomHeader title={course.id} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 32, paddingBottom: 16 }}>
        <ThemedText
            type="title"
            style={{ maxWidth: '70%', flexShrink: 1 }}
            ellipsizeMode="tail"
          >
            {course.name}
          </ThemedText>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => setConfigModalVisible(true)} style={{ marginRight: 10 }}>
            <Ionicons name="cog-outline" size={24} color={Colors[colorScheme].tint} />
          </TouchableOpacity>
          <Link href={`/edit-course/${course.id}`} asChild>
            <TouchableOpacity style={{ marginRight: 10 }}>
              <Ionicons name="pencil" size={24} color={Colors[colorScheme].tint} />
            </TouchableOpacity>
          </Link>
          {/* Add Archive Button */}
          {course.isArchived !== true && (
            <TouchableOpacity onPress={handleArchive} style={{ marginRight: 10 }}>
              <Ionicons name="archive-outline" size={24} color={Colors[colorScheme].warning} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color={Colors[colorScheme].error} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {course && (
          <ConfigurationModal
            isVisible={configModalVisible}
            onClose={() => setConfigModalVisible(false)}
            course={course}
            onUpdateCourse={(updatedCourse) => {
              setCourse(updatedCourse);
              updateCourse(updatedCourse);
            }}
          />
        )}
        <ThemedView style={[styles.card, { borderLeftColor: deltaColor, backgroundColor: Colors[colorScheme].card }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            Attendance Summary
          </ThemedText>

          <View style={styles.attendanceRow}>
            <Ionicons name="pie-chart-outline" size={20} color={Colors[colorScheme].text} />
            <ThemedText style={styles.attendanceText}>
              Current: <ThemedText type="defaultSemiBold">{attendancePercentage}%</ThemedText> (Required: {requiredAttendance}%)
            </ThemedText>
          </View>

          <View style={styles.attendanceRow}>
            <Ionicons
              name={delta <= 0 ? "checkmark-circle-outline" : "alert-circle-outline"}
              size={20}
              color={deltaColor}
            />
            <ThemedText style={[styles.attendanceText, { color: deltaColor }]}>
              {attendanceNote}
            </ThemedText>
          </View>

          <View style={styles.attendanceDetailRow}>
            <View style={styles.attendanceDetailItem}>
              <Ionicons name="checkmark-outline" size={18} color={Colors[colorScheme].success} />
              <Pressable onPress={() => {
                setCountType("presents");
                setInputValue(String(presents));
                setModalVisible(true);
              }}>
                <ThemedText style={[styles.detailText, styles.clickableText]}> Present: {presents}</ThemedText>
              </Pressable>
            </View>
            <View style={styles.attendanceDetailItem}>
              <Ionicons name="close-outline" size={18} color={Colors[colorScheme].error} />
              <Pressable onPress={() => {
                setCountType("absents");
                setInputValue(String(absents));
                setModalVisible(true);
              }}>
                <ThemedText style={[styles.detailText, styles.clickableText]}> Absent: {absents}</ThemedText>
              </Pressable>
            </View>
            <View style={styles.attendanceDetailItem}>
              <Ionicons name="remove-circle-outline" size={18} color={Colors[colorScheme].icon} />
              <Pressable onPress={() => {
                setCountType("cancelled");
                setInputValue(String(cancelled));
                setModalVisible(true);
              }}>
                <ThemedText style={[styles.detailText, styles.clickableText]}> Cancelled: {cancelled}</ThemedText>
              </Pressable>
            </View>
          </View>
        </ThemedView>

        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={onClose}
        >
          <View style={styles.centeredView}>
            <ThemedView style={[styles.modalView, { borderColor }]} lightColor={Colors.light.alert} darkColor={Colors.dark.alert}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                Update {countType.charAt(0).toLocaleUpperCase() + countType.slice(1)} Count
              </ThemedText>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    color: textColor,
                    borderColor: borderColor,
                    backgroundColor: Colors[colorScheme].inputBackground,
                  },
                ]}
                keyboardType="number-pad"
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Enter new count"
                placeholderTextColor={textColor}
              />
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.basicButton,
                    {
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: tintColor,
                      opacity: pressed ? 0.7 : 1,
                      marginLeft: 0,
                      elevation: 0,
                    },
                  ]}
                  onPress={onClose}
                >
                  <ThemedText style={[styles.buttonText, { color: tintColor }]}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.basicButton,
                    {
                      backgroundColor: primaryColor,
                      opacity: pressed ? 0.7 : 1,
                      marginLeft: 10,
                      elevation: 2,
                    },
                  ]}
                  onPress={() => {
                    setModalVisible(false);
                    const newValue = parseInt(inputValue, 10);
                    if (!isNaN(newValue) && newValue >= 0) {
                      updateCourseCounts(course.id, countType, newValue);
                    } else {
                      showAlert('Invalid Input', 'Please enter a valid non-negative number.');
                    }
                  }}
                >
                  <ThemedText style={[styles.buttonText, { color: '#fff' }]}>Submit</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </View>
        </Modal>

        {(course.weeklySchedule && course.weeklySchedule.length > 0) && (
          <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              Weekly Schedule
            </ThemedText>
            {course.weeklySchedule.filter(item => typeof item.timeStart === 'string' && typeof item.timeEnd === 'string').map((item: ScheduleItem) => (
              <View key={item.id} style={styles.scheduleItem}>
                <Ionicons name="calendar-outline" size={18} color={Colors[colorScheme].icon} />
                <ThemedText style={styles.scheduleText}>
                  <ThemedText type="defaultSemiBold">{item.day}:</ThemedText> {formatTime(item.timeStart, is24Hour)} - {formatTime(item.timeEnd, is24Hour)}
                </ThemedText>
              </View>
            ))}
          </ThemedView>
        )}

        {(course.extraClasses && course.extraClasses.length > 0) && (
          <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              Extra Classes
            </ThemedText>
            {course.extraClasses.filter(item => typeof item.timeStart === 'string' && typeof item.timeEnd === 'string').map((item: ExtraClass) => {
              return (
                <View key={item.id} style={styles.scheduleItem}>
                  <Ionicons name="add-circle-outline" size={18} color={Colors[colorScheme].tint} />
                  <ThemedText style={styles.scheduleText}>
                    <ThemedText type="defaultSemiBold">{item.date}:</ThemedText> {formatTime(item.timeStart, is24Hour)} - {formatTime(item.timeEnd, is24Hour)}
                  </ThemedText>
                  {(
                    <TouchableOpacity
                      style={{ marginLeft: 'auto' }}
                      onPress={() => {
                        showAlert(
                          'Delete Extra Class',
                          `Are you sure you want to delete the extra class on ${item.date}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                if (course) {
                                  deleteExtraClass(course.id, item.id);
                                  deleteAttendanceRecord(course.id, item.date, item.timeStart, item.timeEnd, true);
                                }
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={Colors[colorScheme].error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ThemedView>
        )}

        <AttendanceHistory
          title="Attendance History"
          courseId={course.id}
          records={attendanceRecords}
          courses={courses}
          onRecordClick={handleAttendanceClick}
          currentPage={page}
          totalRecords={totalRecords}
          recordsPerPage={recordsPerPage}
          onPageChange={setPage}
        />

        <View style={{ height: 20 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderColor: 'transparent',
  },
  cardTitle: {
    marginBottom: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    marginRight: 10,
  },
  headerIcon: {
    marginLeft: 16,
  },
  backButton: {
    marginTop: 20,
    padding: 10,
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  attendanceText: {
    marginLeft: 8,
    fontSize: 16,
  },
  attendanceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    flexWrap: 'wrap',
  },
  attendanceDetailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    minWidth: 100,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 4,
    fontSize: 14,
  },
  clickableText: {
    cursor: 'pointer',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  scheduleText: {
    marginLeft: 8,
    fontSize: 15,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  historyText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '500',
  },
  historyDateText: {
    marginLeft: 'auto',
    fontSize: 14,
    opacity: 0.8,
  },
  extraClassTag: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContainer: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '85%',
    maxWidth: 450,
    margin: 20,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalTextInput: {
    height: 45,
    borderWidth: 1,
    paddingHorizontal: 15,
    borderRadius: 8,
    width: '80%',
    marginBottom: 0,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20,
  },
  basicButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonMargin: {
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
});
