import React, { useContext, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme as useNativeColorScheme, // Rename to avoid conflict
  Alert,
  Pressable,
  TextInput,
} from 'react-native';
import Modal from 'react-native-modal';
import { Stack, useLocalSearchParams, useRouter, Link } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Course, ScheduleItem, ExtraClass, AttendanceRecord } from '@/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
// Assuming useColorScheme hook provides 'light' | 'dark'
import { useCustomAlert } from '@/context/AlertContext'; // Import the custom alert hook

// --- Helper functions copied/adapted from index.tsx ---

// Helper to calculate attendance delta.
const getAttendanceDelta = (
  presents: number,
  absents: number,
  requiredAttendance: number
): number => {
  const total = presents + absents;
  const requiredFraction = requiredAttendance / 100;
  if (total === 0) {
    return 0; // No classes held yet
  }
  const currentFraction = presents / total;
  if (currentFraction >= requiredFraction) {
    // Calculate how many classes can be bunked.
    return -Math.floor(presents / requiredFraction - total);
  } else {
    // Calculate extra classes needed.
    return Math.ceil(
      (requiredFraction * total - presents) / (1 - requiredFraction)
    );
  }
};

// Assign a border color or accent color based on delta.
const getDeltaColor = (delta: number, colorScheme: 'light' | 'dark') => {
  if (delta > 0) return Colors[colorScheme].error; // Need to attend => red accent
  if (delta < 0) return Colors[colorScheme].success; // Can bunk => green accent
  return Colors[colorScheme].tint; // Exactly at required => yellow/default tint accent
};

// --- Component Start ---

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { courses, loading, deleteCourse, updateCourse, changeAttendanceRecord, updateCourseCounts } = useContext(AppContext);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  // Use the hook correctly
  const colorScheme = useNativeColorScheme() ?? 'light'; // Default to light if null
  const { showAlert } = useCustomAlert();

  // State variables for the modal
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
      // Ensure case-insensitive comparison if IDs might differ in case
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
            router.back(); // Go back after deletion
          },
        },
      ]
    );
  };

  // --- Loading and Not Found States ---
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

  // --- Calculations ---
  const presents = course.presents || 0;
  const absents = course.absents || 0;
  const cancelled = course.cancelled || 0;
  const attendancePercentage = course.attendancePercentage || 0;
  const requiredAttendance = course.requiredAttendance || 75; // Default if not set
  const delta = getAttendanceDelta(presents, absents, requiredAttendance);
  const deltaColor = getDeltaColor(delta, colorScheme);

  let attendanceNote = 'Meeting required attendance';
  if (delta > 0) {
    attendanceNote = `Need to Attend: ${delta} more class${delta === 1 ? '' : 'es'}`;
  } else if (delta < 0) {
    attendanceNote = `Can Bunk: ${Math.abs(delta)} class${Math.abs(delta) === 1 ? '' : 'es'}`;
  }

  // --- Render ---
  return (
    <>
      <Stack.Screen
        options={{
          title: course.id, // Use course name for the title
          headerStyle: {
            backgroundColor: Colors[colorScheme].card,
          },
          headerTintColor: Colors[colorScheme].text,
          headerTitleStyle: {
          fontWeight: 'bold', // Optional: make title bold
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
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="close-circle-outline" size={24} color={Colors[colorScheme].error} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
        contentContainerStyle={styles.contentContainer}
      >
        {/* --- Attendance Card --- */}
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
          isVisible={modalVisible}
          onBackdropPress={() => setModalVisible(false)} // Close on backdrop press
          animationIn="fadeInUp" // Smoother animation
          animationOut="fadeOutDown"
          backdropOpacity={0.4} // Dim background slightly
          style={styles.modalContainer} // Use style for margin/justifyContent
        >
          {/* Use ThemedView for consistent background and theme handling */}
          <ThemedView style={styles.modalView}>
            {/* Dynamic Title */}
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Update {countType.charAt(0).toUpperCase() + countType.slice(1)} Count
            </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: Colors[colorScheme].text,
                    borderColor: Colors[colorScheme].border,
                    // Use background color as fallback, as inputBackground doesn't exist
                    backgroundColor: Colors[colorScheme].background || Colors[colorScheme].card,
                  }
                ]}
                onChangeText={setInputValue}
                value={inputValue}
                keyboardType="number-pad"
                placeholder={`Enter new ${countType} count`} // Add placeholder
                placeholderTextColor={Colors[colorScheme].icon} // Style placeholder
                autoFocus={true} // Focus input on open
              />
              {/* Button Container */}
              <View style={styles.modalButtonContainer}>
                {/* Cancel Button */}
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: Colors[colorScheme].error }]} // Use theme error color
                  onPress={() => setModalVisible(false)} // Just close
                >
                  <ThemedText style={styles.buttonTextStyle}>Cancel</ThemedText>
                </TouchableOpacity>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: Colors[colorScheme].tint }]} // Use theme tint color
                  onPress={() => {
                    setModalVisible(false); // Close modal first
                    const newValue = parseInt(inputValue, 10);
                    // Validate input: ensure it's a non-negative number
                    if (!isNaN(newValue) && newValue >= 0) {
                      updateCourseCounts(course.id, countType, newValue);
                    } else {
                      // Show an alert for invalid input
                      showAlert('Invalid Input', 'Please enter a valid non-negative number.');
                      // Optional: Re-open modal or clear input. Let's not re-open for now.
                      // setInputValue(''); // Clear invalid input
                    }
                  }}
                >
                  <ThemedText style={styles.buttonTextStyle}>Submit</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
        </Modal>

        {/* --- Weekly Schedule Card --- */}
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

        {/* --- Extra Classes Card --- */}
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

        {/* Optional: Add a spacer at the bottom */}
         {/* --- Attendance History Card --- */}
         {(course.attendanceRecords && course.attendanceRecords.length > 0) ? (
           <ThemedView style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
             <ThemedText type="subtitle" style={styles.cardTitle}>
               Attendance History
             </ThemedText>
             {/* Sort records newest first */}
             {[...course.attendanceRecords]
               .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
               .map((record) => {
                 const recordDate = new Date(record.data);
                 const formattedDate = recordDate.toLocaleDateString(undefined, {
                   year: 'numeric', month: 'long', day: 'numeric'
                 });
                 let statusIcon: keyof typeof Ionicons.glyphMap = 'help-circle-outline';
                 let statusColor = Colors[colorScheme].text;
                 let displayStatusText = 'Unknown'; // Use a separate variable for display

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
                     statusColor = Colors[colorScheme].warning; // Or use a neutral color
                     displayStatusText = 'Cancelled';
                     break;
                 }

                 return (
                   <TouchableOpacity key={record.id} style={styles.historyItem} onPress={() => handleAttendanceClick(record.id)}>
                     <Ionicons name={statusIcon} size={18} color={statusColor} />
                     <ThemedText style={[styles.historyText, { color: statusColor }]}>
                        {displayStatusText} {/* Use the display variable here */}
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

// --- Styles ---
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
    borderRadius: 16, // Match index.tsx
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 5, // Accent border
    borderColor: 'transparent', // Default to transparent, override for attendance
    // Shadow/Elevation (consider adjusting based on theme)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    marginBottom: 12,
    fontSize: 18, // Slightly larger title
  },
  headerButtons: {
    flexDirection: 'row',
    marginRight: 10, // Adjust spacing as needed
  },
  headerIcon: {
    marginLeft: 16, // Space between icons
  },
  backButton: {
    marginTop: 20,
    padding: 10,
  },
  // Attendance Card Specific Styles
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
    // Use a subtle border color based on theme
    // borderTopColor: Colors[colorScheme].border, // Assuming border color exists in Colors
     borderTopColor: 'rgba(128, 128, 128, 0.2)', // Fallback gray border
  },
  attendanceDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 4,
    fontSize: 14,
  },
  // Schedule Card Specific Styles
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  scheduleText: {
    marginLeft: 8,
    fontSize: 15,
  },
  // Attendance History Card Specific Styles
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)', // Subtle separator
    // Use theme color for border if available: Colors[colorScheme].border
  },
  historyText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '500', // Medium weight for status
  },
  historyDateText: {
    marginLeft: 'auto', // Push date to the right
    fontSize: 14,
     opacity: 0.8,
   },
   extraClassTag: {
     fontSize: 12, // Smaller font size for the tag
     fontWeight: '600', // Slightly bolder
     marginLeft: 4, // Space before the tag
     // Optional: Add a subtle background or color if desired
     // color: Colors[colorScheme].tint,
   },
   // Modal Styles
   modalContainer: { // Style for the Modal component itself
     margin: 0, // Remove default margins from react-native-modal
     justifyContent: 'center',
     alignItems: 'center',
   },
   modalView: { // Style for the content container (ThemedView)
     width: '90%', // Wider modal
     maxWidth: 350, // Max width constraint
     borderRadius: 16, // Consistent rounding
     padding: 25, // Slightly more padding
     alignItems: 'center', // Center content horizontally
     // Shadows applied by ThemedView potentially, or add here if needed
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 3 },
     shadowOpacity: 0.15,
     shadowRadius: 5,
     elevation: 5,
     // Background color is handled by ThemedView
     // Border color can be added if desired, e.g., borderColor: Colors[colorScheme].border, borderWidth: 1,
   },
   modalTitle: {
     marginBottom: 20, // Space below title
     textAlign: 'center',
     fontSize: 18, // Match card title size
   },
   textInput: {
     height: 45, // Slightly taller
     borderWidth: 1,
     paddingHorizontal: 15, // More horizontal padding
     borderRadius: 8, // More rounded corners
     width: '100%', // Use full width of modal content area
     marginBottom: 25, // Space below input
     fontSize: 16,
   },
   modalButtonContainer: {
     flexDirection: 'row',
     justifyContent: 'space-between', // Space out buttons
     width: '100%', // Use full width
     marginTop: 10, // Add some space above buttons
   },
   button: {
     borderRadius: 10, // More rounded buttons
     paddingVertical: 12,
     paddingHorizontal: 20,
     justifyContent: 'center',
     alignItems: 'center',
     flex: 1, // Make buttons share space equally
     marginHorizontal: 8, // Space between buttons
     minHeight: 44, // Ensure minimum tap target size for accessibility
     elevation: 2, // Add slight elevation to buttons
   },
   buttonTextStyle: { // Renamed from textStyle for clarity
     fontSize: 16,
     textAlign: 'center',
     fontWeight: 'bold',
     color: '#FFFFFF', // Explicitly white, or use a theme color for button text if defined
   },
   // Removed buttonClose, buttonCancel, modalText, centeredView as they are replaced/handled differently or unused
 });

const bottomButtons = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flexDirection: 'row' as 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingHorizontal: 20,
  },
});

const editButton = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    backgroundColor: Colors[colorScheme].card,
    padding: 10,
    borderRadius: 8,
  },
});

const deleteButton = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    backgroundColor: Colors[colorScheme].card,
    padding: 10,
    borderRadius: 8,
  },
});
