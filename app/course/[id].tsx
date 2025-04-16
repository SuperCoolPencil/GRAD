import React, { useContext, useEffect, useState } from 'react';
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
} from 'react-native';
import { Modal } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, Link } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course, ScheduleItem, ExtraClass, AttendanceRecord } from '@/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { useCustomAlert } from '@/context/AlertContext';
import { useThemeColor } from '@/hooks/useThemeColor';

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
    changeAttendanceRecord,
    updateCourseCounts,
    archiveCourse, // Import archiveCourse
  } = useContext(AppContext);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const colorScheme = useNativeColorScheme() ?? 'light';
  const { showAlert } = useCustomAlert();

  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const primaryColor = useThemeColor({}, 'alertPrimary');
  const tintColor = useThemeColor({}, 'tint');

  const [modalVisible, setModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [countType, setCountType] = useState<"presents" | "absents" | "cancelled">("presents");

  const handleAttendanceClick = (recordId: string) => {
    if (!course) return;

    let newStatus: "present" | "absent" | "cancelled";
    const record = course.attendanceRecords?.find(r => r.id === recordId);
    if (!record) return;

    switch (record.Status) {
      case 'present':
        newStatus = 'absent';
        break;
      case 'absent':
        newStatus = 'cancelled';
        break;
      case 'cancelled':
        newStatus = 'present';
        break;
      default:
        newStatus = 'present';
    }

    changeAttendanceRecord(course.id, recordId, newStatus);
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
      `Archived courses no longer appear in your courses list, weekly schedules, or trigger notifications`,
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
      <Stack.Screen
        options={{
          title: course.id,
          headerStyle: {
            backgroundColor: Colors[colorScheme].card,
          },
          headerTintColor: Colors[colorScheme].text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 32 }}>
        <ThemedText type="title">{course.name}</ThemedText>
        <View style={{ flexDirection: 'row' }}>
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
      >
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
                <ThemedText style={styles.detailText}> Present: {presents}</ThemedText>
              </Pressable>
            </View>
            <View style={styles.attendanceDetailItem}>
              <Ionicons name="close-outline" size={18} color={Colors[colorScheme].error} />
              <Pressable onPress={() => {
                setCountType("absents");
                setInputValue(String(absents));
                setModalVisible(true);
              }}>
                <ThemedText style={styles.detailText}> Absent: {absents}</ThemedText>
              </Pressable>
            </View>
            <View style={styles.attendanceDetailItem}>
              <Ionicons name="remove-circle-outline" size={18} color={Colors[colorScheme].icon} />
              <Pressable onPress={() => {
                setCountType("cancelled");
                setInputValue(String(cancelled));
                setModalVisible(true);
              }}>
                <ThemedText style={styles.detailText}> Cancelled: {cancelled}</ThemedText>
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
            {course.weeklySchedule.map((item: ScheduleItem) => (
              <View key={item.id} style={styles.scheduleItem}>
                <Ionicons name="calendar-outline" size={18} color={Colors[colorScheme].icon} />
                <ThemedText style={styles.scheduleText}>
                  <ThemedText type="defaultSemiBold">{item.day}:</ThemedText> {item.timeStart} - {item.timeEnd}
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
            {course.extraClasses.map((item: ExtraClass) => (
              <View key={item.id} style={styles.scheduleItem}>
                <Ionicons name="add-circle-outline" size={18} color={Colors[colorScheme].tint} />
                <ThemedText style={styles.scheduleText}>
                  <ThemedText type="defaultSemiBold">{item.date}:</ThemedText> {item.timeStart} - {item.timeEnd}
                </ThemedText>
              </View>
            ))}
          </ThemedView>
        )}

        {(course.attendanceRecords && course.attendanceRecords.length > 0) ? (
          <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              Attendance History
            </ThemedText>
            {[...course.attendanceRecords]
              .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
              .map((record) => {
                const recordDate = new Date(record.data);
                const formattedDate = recordDate.toLocaleDateString(undefined, {
                  year: 'numeric', month: 'long', day: 'numeric'
                });
                let statusIcon: keyof typeof Ionicons.glyphMap = 'help-circle-outline';
                let statusColor = Colors[colorScheme].text;
                let displayStatusText = 'Unknown';

                switch (record.Status) {
                  case 'present':
                    statusIcon = 'checkmark-circle-outline';
                    statusColor = Colors[colorScheme].success;
                    displayStatusText = 'Present';
                    break;
                  case 'absent':
                    statusIcon = 'close-circle-outline';
                    statusColor = Colors[colorScheme].error;
                    displayStatusText = 'Absent';
                    break;
                  case 'cancelled':
                    statusIcon = 'remove-circle-outline';
                    statusColor = Colors[colorScheme].warning;
                    displayStatusText = 'Cancelled';
                    break;
                }

                return (
                  <TouchableOpacity key={record.id} style={styles.historyItem} onPress={() => handleAttendanceClick(record.id)}>
                    <Ionicons name={statusIcon} size={18} color={statusColor} />
                    <ThemedText style={[styles.historyText, { color: statusColor }]}>
                      {displayStatusText}
                    </ThemedText>
                    <ThemedText style={styles.historyDateText}>
                      on {formattedDate} {record.isExtraClass ? <ThemedText style={styles.extraClassTag}>(Extra)</ThemedText> : ''}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
          </ThemedView>
        ) : (
          <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderLeftWidth: 0 }]}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              Attendance History
            </ThemedText>
            <ThemedText style={{ opacity: 0.7 }}>No attendance recorded yet.</ThemedText>
          </ThemedView>
        )}

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    marginBottom: 12,
    fontSize: 18,
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
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  attendanceDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 4,
    fontSize: 14,
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
});
