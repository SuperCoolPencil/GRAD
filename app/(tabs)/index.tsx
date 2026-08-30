import React, { useContext, useState, useEffect, type Dispatch, type SetStateAction } from "react";
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  View,
  useColorScheme,
} from "react-native";
import { Colors } from "@/constants/Colors";
import { AppContext } from "@/context/AppContext";
import { useCustomAlert } from "@/context/AlertContext";
import { formatTime } from "@/utils/time";
import { formatDateToISO, parseISOToDate } from '@/utils/dateHelpers';
import { AttendanceRecord, ClassItem, Course, ScheduleItem, ExtraClass, Holiday, SkipDay } from "@/types";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import ExtraClassTag from "@/components/ui/ExtraClassTag";
import { getCourseAttendanceDelta, simulateBunkClass, type BunkSimulationResult } from '@/utils/attendance';
import { BunkSimModal } from '@/components/BunkSimModal';

const truncate = (value: string, length: number) => value.length > length ? `${value.slice(0, length - 1)}...` : value;

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Assign a border color or accent color based on delta.
const getDeltaColor = (delta: number, colorScheme: "light" | "dark") => {
  if (delta > 0) return Colors[colorScheme].error; // Need to attend => red accent
  if (delta < 0) return Colors[colorScheme].success; // Can bunk => green accent
  return Colors[colorScheme].success; // On target is a success state too
};

export default function TodaysClassesScreen() {
  const { courses, upsertAttendance, loading, is24Hour, holidays, skipDays } = useContext(AppContext);
  const { showAlert } = useCustomAlert();
  const [todaysClasses, setTodaysClasses] = useState<ClassItem[]>([]);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const colorScheme: "light" | "dark" = useColorScheme() as "light" | "dark";
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme || "light"].background }}>
      <ThemedView style={styles.titleContainer}>
        <View style={styles.titleTextContainer}>
          <TouchableOpacity
            onPress={() => setShowTomorrow(!showTomorrow)}
            style={[
              styles.dateToggleTag,
              { backgroundColor: Colors[colorScheme || "light"].cardBackground },
            ]}
          >
            <ThemedText type="title" style={{ color: Colors[colorScheme || "light"].text }}>
              {showTomorrow ? "Tomorrow" : "Today"}
            </ThemedText>
          </TouchableOpacity>
          <ThemedText
            type="title"
            style={[styles.classesText, { color: Colors[colorScheme || "light"].text }]}
          >
            's Classes
          </ThemedText>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: Colors[colorScheme || 'light'].cardBackground }]}
          onPress={() => {
            if (courses.filter(course => !course.isArchived).length === 0) {
              showAlert(
                "No Courses",
                "Create a course first",
                [
                  { text: "OK" },
                  { text: "Create Course", onPress: () => router.push("/add-course") }
                ]
              );
            } else {
              router.push("/add-extra-class");
            }
          }}
        >
          <Ionicons
            name="add-circle-outline"
            size={22}
            color={Colors[colorScheme || "light"].tint}
          />
        </TouchableOpacity>
      </ThemedView>
      <TodaysClassesContent
        courses={courses}
        upsertAttendance={upsertAttendance}
        loading={loading}
        todaysClasses={todaysClasses}
        setTodaysClasses={setTodaysClasses}
        colorScheme={colorScheme}
        is24Hour={is24Hour}
        showTomorrow={showTomorrow}
        holidays={holidays}
        skipDays={skipDays}
      />
    </View>
  );
}

function TodaysClassesContent({
  courses,
  upsertAttendance,
  loading,
  todaysClasses,
  setTodaysClasses,
  colorScheme,
  is24Hour,
  showTomorrow,
  holidays,
  skipDays,
}: {
  courses: Course[];
  upsertAttendance: (courseId: string, scheduleId: string, status: AttendanceRecord['status'], isExtraClass: boolean, timeStart: string, timeEnd: string, date: string) => void;
  loading: boolean;
  todaysClasses: ClassItem[];
  setTodaysClasses: Dispatch<SetStateAction<ClassItem[]>>;
  colorScheme: 'light' | 'dark';
  is24Hour: boolean;
  showTomorrow: boolean;
  holidays: Holiday[];
  skipDays: SkipDay[];
}) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holiday, setHoliday] = useState<Holiday | undefined>(undefined);
  const [activeSim, setActiveSim] = useState<{ courseName: string; simulation: BunkSimulationResult } | null>(null);

  useEffect(() => {
    if (loading) return; // Wait until courses are loaded

    const now = new Date();
    if (showTomorrow) {
      now.setDate(now.getDate() + 1); // Increment date by 1 for tomorrow
    }
    setCurrentDate(now);

    const currentHoliday = holidays.find(h => {
      const startDate = parseISOToDate(h.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = parseISOToDate(h.endDate);
      endDate.setHours(0, 0, 0, 0);
      const checkDate = new Date(now);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate >= startDate && checkDate <= endDate;
    });
    setHoliday(currentHoliday);

    const currentDayName = DAYS_OF_WEEK[now.getDay()];
    const currentDateString = formatDateToISO(now); // YYYY-MM-DD

    let classesForToday: ClassItem[] = [];

    courses.forEach((course: Course) => {
      // Skip archived courses
      if (course.isArchived) {
        return;
      }

      const required = course.requiredAttendance || 75;
      const attendancePercentage = course.attendancePercentage || 0;
          const delta = getCourseAttendanceDelta(course, holidays, skipDays);

      // Process weekly scheduled classes only if it's not a holiday
      if (!currentHoliday) {
        course.weeklySchedule?.forEach((schedule: ScheduleItem) => {
          if (schedule.day === currentDayName) {
            const record = course.attendanceRecords?.find(
              (r) =>
                r.date === currentDateString &&
                r.timeStart === schedule.timeStart &&
                r.timeEnd === schedule.timeEnd &&
                !r.isExtraClass
            );
            classesForToday.push({
              id: `${course.id}-${schedule.id}`,
              sourceId: schedule.id,
              courseId: course.id,
              courseName: course.name,
              timeStart: schedule.timeStart,
              timeEnd: schedule.timeEnd,
              isExtraClass: false,
              requiredAttendance: required,
              currentAttendance: attendancePercentage,
              needToAttend: delta,
              status: record?.status,
            });
          }
        });
      }

      // Process extra classes (always, regardless of holiday)
      course.extraClasses?.forEach((extra: ExtraClass) => {
        if (extra.date === currentDateString) {
          const record = course.attendanceRecords?.find(
            (r) =>
              r.date === currentDateString &&
              r.timeStart === extra.timeStart &&
              r.timeEnd === extra.timeEnd &&
              r.isExtraClass
          );
          classesForToday.push({
            id: `${course.id}-extra-${extra.id}`,
            sourceId: extra.id,
            courseId: course.id,
            courseName: course.name,
            timeStart: extra.timeStart,
            timeEnd: extra.timeEnd,
            isExtraClass: true,
            requiredAttendance: required,
            currentAttendance: attendancePercentage,
            needToAttend: delta,
            status: record?.status,
          });
        }
      });
    });

    // Filter out any classes that might have invalid time data to prevent crashes
    const validClasses = classesForToday.filter(c => typeof c.timeStart === 'string' && typeof c.timeEnd === 'string');

    // Sort classes by start time.
    validClasses.sort((a, b) => {
      const [hourA, minuteA] = a.timeStart.split(':').map(Number);
      const [hourB, minuteB] = b.timeStart.split(':').map(Number);
      return hourA !== hourB ? hourA - hourB : minuteA - minuteB;
    });

    setTodaysClasses(validClasses);
  }, [courses, loading, showTomorrow, holidays, skipDays, setTodaysClasses]);

  const handleMarkAttendance = (
    courseId: string,
    status: "present" | "absent" | "cancelled",
    isExtraClass: boolean,
    sourceId: string,
    timeStart: string,
    timeEnd: string
  ) => {
    const dateString = formatDateToISO(currentDate); // YYYY-MM-DD
    upsertAttendance(courseId, sourceId, status, isExtraClass, timeStart, timeEnd, dateString);
  };

  const renderClassItem = ({ item }: { item: ClassItem }) => {
    const course = courses.find(c => c.id === item.courseId);
    const simulation = course ? simulateBunkClass(course, holidays, skipDays, 1, {
      date: formatDateToISO(currentDate),
      courseId: item.courseId,
      timeStart: item.timeStart,
      timeEnd: item.timeEnd,
    }) : null;
    const accentColor = getDeltaColor(item.needToAttend, colorScheme || 'light');
    const cardBackground =
      colorScheme === 'dark' ? Colors[colorScheme].alert : Colors[colorScheme].card;
    // We can color-code the text that indicates how many you must attend/bunk
    let attendanceNote = 'On target';
    if (item.needToAttend > 0) {
      attendanceNote = `Attend ${item.needToAttend} more class${item.needToAttend === 1 ? '' : 'es'}`;
    } else if (item.needToAttend < 0) {
      const available = Math.abs(item.needToAttend);
      attendanceNote = `Can miss ${available} class${available === 1 ? '' : 'es'}`;
    }

    return (
      <TouchableOpacity
        style={[
          styles.classCardContainer,
          {
            backgroundColor: cardBackground,
          },
        ]}
        onPress={() => router.push(`/course/${item.courseId}`)}
      >
        <ThemedView
          style={[
            styles.classCardContent,
            {
              backgroundColor: Colors[colorScheme || 'light'].card,
              paddingVertical: showTomorrow ? 12 : 16,
            },
          ]}
        >
          <View style={styles.classInfo}>
            <View style={{ position: 'relative' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ThemedText type="itemTitle" style={styles.courseName}>
                  {truncate(item.courseName, 20)}
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={Colors[colorScheme || 'light'].icon}
                  style={{ marginRight: 4 }}
                />
                <ThemedText>
                  {formatTime(item.timeStart, is24Hour)} - {formatTime(item.timeEnd, is24Hour)}
                </ThemedText>
                {item.isExtraClass && <ExtraClassTag />}
              </View>
              <View style={styles.infoRow}>
                <Ionicons
                  name="stats-chart-outline"
                  size={16}
                  color={Colors[colorScheme || 'light'].icon}
                  style={{ marginRight: 4 }}
                />
                <ThemedText>
                  Attendance {item.currentAttendance}% · Target {item.requiredAttendance}%
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <Ionicons
                  name={item.needToAttend <= 0 ? "checkmark-circle-outline" : "alert-circle-outline"}
                  size={16}
                  color={accentColor}
                  style={{ marginRight: 4 }}
                />
                <ThemedText style={{ color: accentColor }}>
                  {attendanceNote}
                </ThemedText>
              </View>
              {simulation && (
                <Pressable
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 2,
                    marginVertical: 2,
                    opacity: pressed ? 0.6 : 1,
                  })}
                  onPress={(e) => {
                    e.stopPropagation();
                    setActiveSim({ courseName: item.courseName, simulation });
                  }}
                >
                  <Ionicons
                    name={simulation.isSafe ? "shield-checkmark-outline" : "warning-outline"}
                    size={16}
                    color={simulation.isSafe ? Colors[colorScheme || 'light'].success : Colors[colorScheme || 'light'].error}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText style={{ fontSize: 14, color: simulation.isSafe ? Colors[colorScheme || 'light'].success : Colors[colorScheme || 'light'].error }}>
                    Bunk Sim: {simulation.currentPercentage}% → {simulation.simulatedPercentage}%
                  </ThemedText>
                </Pressable>
              )}
              {item.status && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: Colors[colorScheme || 'light'].cardBackground, // A slightly different background to make it stand out
                  }}
                >
                  <Ionicons
                    name={item.status === 'present' ? 'checkmark-circle-outline' : item.status === 'absent' ? 'close-circle-outline' : 'remove-circle-outline'}
                    size={20}
                    color={item.status === 'present' ? Colors[colorScheme || 'light'].success : item.status === 'absent' ? Colors[colorScheme || 'light'].error : Colors[colorScheme || 'light'].icon}
                  />
                  <ThemedText style={{ marginLeft: 4, fontSize: 12, textTransform: 'capitalize' }}>{item.status}</ThemedText>
                </View>
              )}
            </View>
          </View>

          {!showTomorrow && ( // Conditionally render attendance actions
            <View style={styles.attendanceActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors[colorScheme].success }]}
                onPress={() =>
                  handleMarkAttendance(item.courseId, 'present', item.isExtraClass, item.sourceId, item.timeStart, item.timeEnd)
                }
              >
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors[colorScheme].buttonText} />
                <ThemedText style={{ color: Colors[colorScheme].buttonText }}>Present</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors[colorScheme || 'light'].error }]}
                onPress={() =>
                  handleMarkAttendance(item.courseId, 'absent', item.isExtraClass, item.sourceId, item.timeStart, item.timeEnd)
                }
              >
                <Ionicons name="close-circle-outline" size={20} color={Colors[colorScheme].buttonText} />
                <ThemedText style={{ color: Colors[colorScheme].buttonText }}>Absent</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.cancelActionButton, { borderColor: Colors[colorScheme || 'light'].icon }]}
                onPress={() =>
                  handleMarkAttendance(item.courseId, 'cancelled', item.isExtraClass, item.sourceId, item.timeStart, item.timeEnd)
                }
              >
                <Ionicons name="remove-circle-outline" size={20} color={Colors[colorScheme || 'light'].textSecondary} />
                <ThemedText style={{ color: Colors[colorScheme || 'light'].textSecondary }}>Cancelled</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ThemedView>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={{ flex: 1, backgroundColor: Colors[colorScheme || "light"].background }}>
      {holiday && (
        <ThemedView style={[styles.holidayBanner, { backgroundColor: Colors[colorScheme || "light"].card }]}>
          <ThemedText type="subtitle" style={[styles.holidayText, { color: Colors[colorScheme || "light"].text }]}>
            Enjoy <ThemedText type="subtitle" style={{ fontWeight: 'bold', color: Colors[colorScheme || "light"].text }}>{holiday?.name || "Holiday"}</ThemedText>! 🎉
          </ThemedText>
        </ThemedView>
      )}
      <FlatList
        data={todaysClasses}
        renderItem={renderClassItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.classesList}
        ListEmptyComponent={() => {
          const dayText = showTomorrow ? "tomorrow" : "today";
          return (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={Colors[colorScheme || "light"].icon} style={{ marginBottom: 12 }} />
              <ThemedText style={[styles.emptyText, { color: Colors[colorScheme || "light"].text }]}>
                {holiday && todaysClasses.length === 0
                  ? `No extra classes scheduled for ${dayText}!`
                  : `No classes scheduled for ${dayText}!`}
              </ThemedText>
            </View>
          );
        }}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: Colors[colorScheme || "light"].background }}
      />
      {activeSim && (
        <BunkSimModal
          isVisible
          courseName={activeSim.courseName}
          simulation={activeSim.simulation}
          onClose={() => setActiveSim(null)}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: Colors.light.icon,
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 64,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  titleTextContainer: {
    flexDirection: "row",
    alignItems: "center", // Vertically center the items
  },
  dateToggleTag: {
    paddingVertical: 2,
    paddingRight: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  classesText: {
    // No specific styles needed here, as it will align with the tag due to alignItems: 'center'
  },
  addButton: {
    marginLeft: "auto", // Push the button to the right
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classesList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  // Outer container for the card.
  classCardContainer: {
    borderRadius: 16,
    marginBottom: 0,
  },
  // Inner content container so the left accent doesn't overlap text.
  classCardContent: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 0,
    gap: 16, // Add gap for vertical spacing between classInfo and attendanceActions
  },
  classInfo: {
    // Removed marginBottom, now handled by gap in classCardContent
  },
  courseName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  attendanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 40,
    borderRadius: 10,
    marginHorizontal: 4,
    justifyContent: 'center',
    gap: 4,
  },
  cancelActionButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
  },
  holidayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: '#000', // Add shadow for card-like effect
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // For Android shadow
  },
  holidayText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
