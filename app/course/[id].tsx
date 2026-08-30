import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme as useNativeColorScheme,
  Pressable,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import AttendanceHistory from '@/components/AttendanceHistory';
import { AppContext } from '@/context/AppContext';
import { formatTime } from '@/utils/time';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course, ScheduleItem, ExtraClass, AttendanceRecord } from '@/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { useCustomAlert } from '@/context/AlertContext';
import CustomHeader from '@/components/CustomHeader';
import ConfigurationModal from '@/components/ConfigurationModal';
import { UpdateCountModal } from '@/components/UpdateCountModal';
import { calculateTargetDate, getCourseAttendanceDelta, getPlannedSkipDayAbsences } from '@/utils/attendance';

const getDeltaColor = (delta: number, colorScheme: 'light' | 'dark') => {
  if (delta > 0) return Colors[colorScheme].error;
  if (delta < 0) return Colors[colorScheme].success;
  return Colors[colorScheme].success;
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
    unarchiveCourse,
    deleteExtraClass,
    is24Hour,
    getPaginatedAttendanceRecords,
    attendanceRecords,
    deleteAttendanceRecord,
    totalRecords,
    loadData,
    holidays,
    skipDays,
  } = useContext(AppContext);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const colorScheme = useNativeColorScheme() ?? 'light';
  const { showAlert, hideAlert } = useCustomAlert();

  const [modalVisible, setModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [countType, setCountType] = useState<"presents" | "absents" | "cancelled">("presents");
  const [page, setPage] = useState(1);
  const recordsPerPage = 10;

  // Calculate target date - must be before any early returns to follow hooks rules
  const targetDateInfo = useMemo(() => {
    if (!course) return null;
    return calculateTargetDate(course, holidays, skipDays);
  }, [course, holidays, skipDays]);


  useEffect(() => {
    if (course) {
      getPaginatedAttendanceRecords(page, recordsPerPage, [course.id]);
    }
  }, [page, course, getPaginatedAttendanceRecords]);

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
          style: 'destructive',
          onPress: () => {
            archiveCourse(course.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleUnarchive = () => {
    if (!course) return;
    showAlert(
      'Unarchive Course',
      `Are you sure you want to unarchive "${course.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unarchive',
          style: 'destructive',
          onPress: () => {
            unarchiveCourse(course.id);
            router.back();
          },
        },
      ]
    );
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
  const delta = getCourseAttendanceDelta(course, holidays, skipDays);
  const deltaColor = getDeltaColor(delta, colorScheme);
  const plannedAbsences = getPlannedSkipDayAbsences(course, holidays, skipDays);
  const projectedTotal = presents + absents + plannedAbsences;
  const projectedAttendance = projectedTotal > 0
    ? Math.round((presents / projectedTotal) * 100)
    : 100;

  let attendanceNote = 'On target';
  if (delta > 0) {
    attendanceNote = `Attend ${delta} more class${delta === 1 ? '' : 'es'}`;
  } else if (delta < 0) {
    attendanceNote = `Can miss ${Math.abs(delta)} class${Math.abs(delta) === 1 ? '' : 'es'}`;
  }
  const forecastSummary = `${plannedAbsences} planned skip${plannedAbsences === 1 ? '' : 's'} · ${projectedAttendance}% projected`;
  const forecastGuidance = targetDateInfo && targetDateInfo.classesNeeded > 0
    ? `Attend ${targetDateInfo.classesNeeded} by${targetDateInfo.targetDate ? ` ${targetDateInfo.targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' your target date'}`
    : null;

  return (
    <>
      <CustomHeader title="Course details" />
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
        <ThemedView style={[styles.heroCard, { backgroundColor: Colors[colorScheme].card }]}>
          <ThemedText type="title" style={styles.courseName}>{course.name}</ThemedText>
          <View style={styles.heroMetaRow}>
            <ThemedText style={styles.heroMeta}>{course.id}</ThemedText>
            {course.isArchived && (
              <View style={[styles.archivedPill, { backgroundColor: `${Colors[colorScheme].warning}18` }]}>
                <Ionicons name="archive-outline" size={12} color={Colors[colorScheme].warning} />
                <ThemedText style={[styles.archivedText, { color: Colors[colorScheme].warning }]}>Archived</ThemedText>
              </View>
            )}
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity accessibilityLabel="Course settings" onPress={() => setConfigModalVisible(true)} style={[styles.heroAction, { backgroundColor: Colors[colorScheme].cardBackground }]}>
              <Ionicons name="options-outline" size={19} color={Colors[colorScheme].tint} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Edit course" onPress={() => router.push(`/edit-course/${course.id}`)} style={[styles.heroAction, { backgroundColor: Colors[colorScheme].cardBackground }]}>
              <Ionicons name="pencil-outline" size={19} color={Colors[colorScheme].tint} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={course.isArchived ? 'Unarchive course' : 'Archive course'}
              onPress={course.isArchived ? handleUnarchive : handleArchive}
              style={[styles.heroAction, { backgroundColor: Colors[colorScheme].cardBackground }]}
            >
              <Ionicons
                name={course.isArchived ? 'arrow-up-circle-outline' : 'archive-outline'}
                size={19}
                color={course.isArchived ? Colors[colorScheme].tint : Colors[colorScheme].warning}
              />
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Delete course" onPress={handleDelete} style={[styles.heroAction, { backgroundColor: Colors[colorScheme].cardBackground }]}>
              <Ionicons name="trash-outline" size={19} color={Colors[colorScheme].error} />
            </TouchableOpacity>
          </View>
        </ThemedView>
        <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
          <View style={styles.attendanceHeader}>
            <ThemedText type="itemTitle" style={styles.cardTitle}>Attendance</ThemedText>
            <View style={[styles.statusPill, { backgroundColor: `${deltaColor}18` }]}>
              <Ionicons name={delta <= 0 ? 'checkmark-circle' : 'alert-circle'} size={14} color={deltaColor} />
              <ThemedText style={[styles.statusPillText, { color: deltaColor }]}>{attendanceNote}</ThemedText>
            </View>
          </View>

          <View style={styles.mainStat}>
            <ThemedText style={styles.percentageText}>{attendancePercentage}%</ThemedText>
            <ThemedText style={styles.percentageSubtext}>Target {requiredAttendance}% · {presents} of {presents + absents} attended</ThemedText>
          </View>

          <View style={styles.statTileRow}>
            <Pressable style={[styles.statTile, { backgroundColor: Colors[colorScheme].cardBackground }]} onPress={() => { setCountType('presents'); setModalVisible(true); }}>
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors[colorScheme].success} />
              <ThemedText style={styles.statTileValue}>{presents}</ThemedText>
              <ThemedText style={styles.statTileLabel}>Attended</ThemedText>
            </Pressable>
            <Pressable style={[styles.statTile, { backgroundColor: Colors[colorScheme].cardBackground }]} onPress={() => { setCountType('absents'); setModalVisible(true); }}>
              <Ionicons name="close-circle-outline" size={16} color={Colors[colorScheme].error} />
              <ThemedText style={styles.statTileValue}>{absents}</ThemedText>
              <ThemedText style={styles.statTileLabel}>Missed</ThemedText>
            </Pressable>
            <Pressable style={[styles.statTile, { backgroundColor: Colors[colorScheme].cardBackground }]} onPress={() => { setCountType('cancelled'); setModalVisible(true); }}>
              <Ionicons name="remove-circle-outline" size={16} color={Colors[colorScheme].icon} />
              <ThemedText style={styles.statTileValue}>{cancelled}</ThemedText>
              <ThemedText style={styles.statTileLabel}>Cancelled</ThemedText>
            </Pressable>
          </View>

          <View style={styles.forecastLine}>
            <Ionicons name="sparkles-outline" size={15} color={deltaColor} />
            <View style={styles.forecastCopy}>
              <ThemedText style={styles.forecastText}>{forecastSummary}</ThemedText>
              {forecastGuidance && <ThemedText style={[styles.forecastText, styles.forecastGuidance]}>{forecastGuidance}</ThemedText>}
            </View>
          </View>
        </ThemedView>

        <UpdateCountModal
          isVisible={modalVisible}
          countType={countType}
          initialValue={countType === 'presents' ? presents : countType === 'absents' ? absents : cancelled}
          onClose={() => setModalVisible(false)}
          onSave={(newValue) => {
            if (course) {
              updateCourseCounts(course.id, countType, newValue);
            }
          }}
        />

        {(course.weeklySchedule && course.weeklySchedule.length > 0) && (
          <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
            <View style={styles.sectionHeader}>
              <ThemedText type="itemTitle" style={styles.cardTitle}>Weekly Schedule</ThemedText>
              <Ionicons name="calendar-outline" size={18} color={Colors[colorScheme].icon} />
            </View>
            {course.weeklySchedule.filter(item => typeof item.timeStart === 'string' && typeof item.timeEnd === 'string').map((item: ScheduleItem) => (
              <View key={item.id} style={[styles.scheduleItem, { backgroundColor: Colors[colorScheme].cardBackground }]}>
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
            <View style={styles.sectionHeader}>
              <ThemedText type="itemTitle" style={styles.cardTitle}>Extra Classes</ThemedText>
              <Ionicons name="add-circle-outline" size={18} color={Colors[colorScheme].tint} />
            </View>
            {course.extraClasses.filter(item => typeof item.timeStart === 'string' && typeof item.timeEnd === 'string').map((item: ExtraClass) => {
              return (
                <View key={item.id} style={[styles.scheduleItem, { backgroundColor: Colors[colorScheme].cardBackground }]}>
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
                      <Ionicons name="close-circle" size={20} color={Colors[colorScheme].error} />
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
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  heroAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseName: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '700',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  heroMeta: {
    fontSize: 13,
    opacity: 0.6,
  },
  archivedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
  },
  archivedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mainStat: {
    alignItems: 'center',
    marginVertical: 4,
  },
  percentageText: {
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 46,
    letterSpacing: -1,
    paddingTop: 4,
  },
  percentageSubtext: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  statTileRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statTile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    gap: 2,
  },
  statTileValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  statTileLabel: {
    fontSize: 11,
    opacity: 0.6,
  },
  headerButtons: {
    flexDirection: 'row',
    marginRight: 10,
  },
  headerIcon: {
    marginLeft: 16,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
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
  forecastLine: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127, 127, 127, 0.25)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  forecastCopy: {
    flex: 1,
    gap: 2,
  },
  forecastText: {
    fontSize: 13,
    opacity: 0.6,
  },
  forecastGuidance: {
    fontWeight: '600',
    opacity: 0.82,
  },
  attendanceDetailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 8,
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
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  scheduleText: {
    marginLeft: 8,
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
