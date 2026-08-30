import React, { useContext, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import Slider from '@react-native-community/slider';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '@/context/AppContext';
import { Colors } from '@/constants/Colors';
import { ThemedText } from '@/components/ThemedText';
import { Course, ScheduleItem } from '@/types';
import { useCustomAlert } from '@/context/AlertContext';
import { formatTime as formatTimeUtil } from '@/utils/time';

interface CourseFormProps {
  initialData?: Partial<Course>;
  onSubmit: (courseData: Course) => Promise<void>;
  isEditing: boolean;
  footer?: React.ReactNode;
}

const days = [
  ['M', 'Monday'], ['T', 'Tuesday'], ['W', 'Wednesday'], ['Th', 'Thursday'],
  ['F', 'Friday'], ['Sa', 'Saturday'], ['Su', 'Sunday'],
] as const;
const dayOrder: string[] = days.map(([, day]) => day);

const CourseForm: React.FC<CourseFormProps> = ({ initialData, onSubmit, isEditing, footer }) => {
  const { isValidCourseId, is24Hour } = useContext(AppContext);
  const { showAlert } = useCustomAlert();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const styles = useMemo(() => getStyles(colorScheme), [colorScheme]);
  const [courseName, setCourseName] = useState(initialData?.name || '');
  const [courseId, setCourseId] = useState(initialData?.id || '');
  const [requiredAttendance, setRequiredAttendance] = useState(initialData?.requiredAttendance || 75);
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleItem[]>(initialData?.weeklySchedule || []);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setCourseName(initialData.name || '');
    setCourseId(initialData.id || '');
    setRequiredAttendance(initialData.requiredAttendance || 75);
    setWeeklySchedule(initialData.weeklySchedule || []);
  }, [initialData]);

  const formatTime = (date: Date) => formatTimeUtil(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), is24Hour);
  const getTimeForStorage = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const sortSchedule = (items: ScheduleItem[]) => [...items].sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day) || a.timeStart.localeCompare(b.timeStart));

  const addWeeklyClass = () => {
    if (!selectedDays.length) return showAlert('Error', 'Please select at least one day.');
    if (!startTime || !endTime) return showAlert('Error', 'Please select a start and end time.');
    if (startTime >= endTime) return showAlert('Error', 'End time must be after start time.');
    const start = getTimeForStorage(startTime);
    const end = getTimeForStorage(endTime);
    const overlaps = weeklySchedule.some(item => selectedDays.includes(item.day) && start < item.timeEnd && end > item.timeStart);
    if (overlaps) return showAlert('Error', 'This schedule overlaps with an existing class time.');
    setWeeklySchedule(sortSchedule([...weeklySchedule, ...selectedDays.map(day => ({ id: `${Date.now()}${Math.random()}`, day, timeStart: start, timeEnd: end }))]));
    setSelectedDays([]);
    setStartTime(null);
    setEndTime(null);
  };

  const handleSubmit = async () => {
    if (!courseName.trim()) return showAlert('Error', 'Please enter a course name.');
    if (!isEditing && !courseId.trim()) return showAlert('Error', 'Please enter a course ID.');
    if (!isEditing && !isValidCourseId(courseId.trim())) return showAlert('Error', 'Course ID must contain only numbers and letters.');
    const courseData: Course = {
      id: courseId.trim(), name: courseName.trim(), requiredAttendance, weeklySchedule: sortSchedule(weeklySchedule),
      presents: initialData?.presents || 0, absents: initialData?.absents || 0, cancelled: initialData?.cancelled || 0,
      attendanceRecords: initialData?.attendanceRecords || [], extraClasses: initialData?.extraClasses || [],
      showInTracker: isEditing ? initialData?.showInTracker : true,
      showInHeatmap: isEditing ? initialData?.showInHeatmap : true,
      showInRadar: isEditing ? initialData?.showInRadar : true,
    };
    if (!weeklySchedule.length) {
      showAlert('No weekly classes?', 'You can add class times later. Would you like to save this course now?', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Save course', onPress: () => onSubmit(courseData) },
      ]);
      return;
    }
    await onSubmit(courseData);
  };

  const renderScheduleItem = ({ item }: { item: ScheduleItem }) => {
    const start = new Date(`2000-01-01T${item.timeStart}`);
    const end = new Date(`2000-01-01T${item.timeEnd}`);
    return <View style={styles.scheduleItem}>
      <View style={styles.scheduleIcon}><Ionicons name="calendar-outline" size={18} color={palette.tint} /></View>
      <View style={styles.scheduleCopy}><ThemedText style={styles.scheduleDay}>{item.day}</ThemedText><ThemedText style={styles.scheduleTime}>{formatTime(start)} – {formatTime(end)}</ThemedText></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${item.day} class`} hitSlop={8} onPress={() => setWeeklySchedule(weeklySchedule.filter(entry => entry.id !== item.id))} style={styles.removeButton}>
        <Ionicons name="close" size={18} color={palette.error} />
      </TouchableOpacity>
    </View>;
  };

  const timePicker = (label: string, value: Date | null, onPress: () => void) => <View style={styles.timeField}>
    <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.timeButton}>
      <Ionicons name="time-outline" size={18} color={palette.tint} />
      <ThemedText style={[styles.timeText, !value && styles.timePlaceholder]}>{value ? formatTime(value) : 'Select time'}</ThemedText>
    </TouchableOpacity>
  </View>;

  return <FlatList
    data={weeklySchedule}
    renderItem={renderScheduleItem}
    keyExtractor={item => item.id}
    style={styles.container}
    contentContainerStyle={styles.contentContainer}
    showsVerticalScrollIndicator={false}
    keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<>
      <View style={styles.intro}><View style={styles.introIcon}><Ionicons name={isEditing ? 'pencil-outline' : 'book-outline'} size={21} color={palette.tint} /></View><View style={styles.introCopy}><ThemedText style={styles.introTitle}>{isEditing ? 'Update course details' : 'Build your course'}</ThemedText><ThemedText style={styles.introText}>{isEditing ? 'Keep the information and class times up to date.' : 'Add the essentials, then set the weekly class times.'}</ThemedText></View></View>
      <View style={styles.card}>
        <View style={styles.cardHeading}><Ionicons name="information-circle-outline" size={19} color={palette.tint} /><ThemedText style={styles.cardTitle}>Course details</ThemedText></View>
        <ThemedText style={styles.fieldLabel}>Course name</ThemedText>
        <TextInput style={styles.input} value={courseName} onChangeText={setCourseName} placeholder="e.g. Calculus" placeholderTextColor={palette.placeholder} autoCapitalize="sentences" />
        {!isEditing && <><ThemedText style={styles.fieldLabel}>Course ID</ThemedText><TextInput style={styles.input} value={courseId} onChangeText={text => setCourseId(text.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} placeholder="e.g. MA102" placeholderTextColor={palette.placeholder} autoCapitalize="characters" /></>}
        <View style={styles.attendanceHeader}><View><ThemedText style={styles.fieldLabel}>Attendance target</ThemedText><ThemedText style={styles.helperText}>The minimum percentage you want to maintain.</ThemedText></View><View style={styles.percentPill}><ThemedText style={styles.percentText}>{requiredAttendance}%</ThemedText></View></View>
        <Slider style={styles.slider} minimumValue={0} maximumValue={100} step={5} value={requiredAttendance} onValueChange={setRequiredAttendance} minimumTrackTintColor={palette.tint} maximumTrackTintColor={palette.separator} thumbTintColor={palette.tint} />
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeading}><Ionicons name="calendar-outline" size={19} color={palette.tint} /><ThemedText style={styles.cardTitle}>Weekly schedule</ThemedText></View>
        <ThemedText style={styles.helperText}>Choose every day this class occurs, then add its time.</ThemedText>
        <ThemedText style={[styles.fieldLabel, styles.daysLabel]}>Days</ThemedText>
        <View style={styles.dayButtonContainer}>{days.map(([short, day]) => { const selected = selectedDays.includes(day); return <TouchableOpacity key={day} accessibilityRole="checkbox" accessibilityLabel={day} accessibilityState={{ checked: selected }} onPress={() => setSelectedDays(selected ? selectedDays.filter(value => value !== day) : [...selectedDays, day])} style={[styles.dayButton, selected && styles.dayButtonSelected]}><ThemedText style={[styles.dayButtonText, selected && styles.dayButtonTextSelected]}>{short}</ThemedText></TouchableOpacity>; })}</View>
        <View style={styles.timeContainer}>{timePicker('Start time', startTime, () => setShowStartTimePicker(true))}{timePicker('End time', endTime, () => setShowEndTimePicker(true))}</View>
        {showStartTimePicker && <DateTimePicker value={startTime || new Date()} mode="time" is24Hour={is24Hour} display="default" onChange={(_: DateTimePickerEvent, time?: Date) => { setShowStartTimePicker(false); if (time) setStartTime(time); }} />}
        {showEndTimePicker && <DateTimePicker value={endTime || new Date()} mode="time" is24Hour={is24Hour} display="default" onChange={(_: DateTimePickerEvent, time?: Date) => { setShowEndTimePicker(false); if (time) setEndTime(time); }} />}
        <TouchableOpacity accessibilityRole="button" onPress={addWeeklyClass} style={styles.addClassButton}><Ionicons name="add" size={19} color={palette.tint} /><ThemedText style={styles.addClassText}>Add class time</ThemedText></TouchableOpacity>
      </View>
      {weeklySchedule.length > 0 && <View style={styles.scheduleLabel}><ThemedText style={styles.sectionLabel}>Scheduled classes</ThemedText><ThemedText style={styles.scheduleCount}>{weeklySchedule.length}</ThemedText></View>}
    </>}
    ListFooterComponent={<><TouchableOpacity accessibilityRole="button" onPress={handleSubmit} style={styles.primaryButton}><Ionicons name="checkmark" size={20} color="#fff" /><ThemedText style={styles.primaryButtonText}>{isEditing ? 'Save changes' : 'Create course'}</ThemedText></TouchableOpacity>{footer && <View style={styles.footer}>{footer}</View>}</>}
  />;
};

const getStyles = (colorScheme: 'light' | 'dark') => {
  const color = Colors[colorScheme];
  const mutedBackground = colorScheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(1,150,255,0.07)';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.background }, contentContainer: { padding: 16, paddingBottom: 28 },
    intro: { flexDirection: 'row', padding: 16, borderRadius: 16, backgroundColor: color.card, marginBottom: 12, gap: 12 }, introIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: mutedBackground, alignItems: 'center', justifyContent: 'center' }, introCopy: { flex: 1 }, introTitle: { fontSize: 16, fontWeight: '700', color: color.text }, introText: { fontSize: 13, lineHeight: 18, color: color.textSecondary, marginTop: 3 },
    card: { backgroundColor: color.card, borderRadius: 16, padding: 16, marginBottom: 12 }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }, cardTitle: { fontSize: 16, fontWeight: '700', color: color.text },
    fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: .55, color: color.textSecondary, marginBottom: 7 }, input: { height: 50, borderRadius: 12, backgroundColor: mutedBackground, paddingHorizontal: 14, fontSize: 15, color: color.text, marginBottom: 16 }, helperText: { fontSize: 13, lineHeight: 18, color: color.textSecondary },
    attendanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 2 }, percentPill: { backgroundColor: mutedBackground, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 9 }, percentText: { color: color.tint, fontWeight: '700', fontSize: 15 }, slider: { width: '100%', height: 38, marginTop: 6 },
    daysLabel: { marginTop: 16 }, dayButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }, dayButton: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: mutedBackground }, dayButtonSelected: { backgroundColor: color.tint }, dayButtonText: { fontSize: 12, fontWeight: '700', color: color.text }, dayButtonTextSelected: { color: '#fff' },
    timeContainer: { flexDirection: 'row', gap: 10 }, timeField: { flex: 1 }, timeButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: mutedBackground }, timeText: { fontSize: 14, fontWeight: '500', color: color.text }, timePlaceholder: { color: color.textSecondary, fontWeight: '400' }, addClassButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: `${color.tint}66`, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, addClassText: { color: color.tint, fontSize: 14, fontWeight: '700' },
    scheduleLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10, paddingHorizontal: 2 }, sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: .6, color: color.textSecondary }, scheduleCount: { minWidth: 22, textAlign: 'center', borderRadius: 11, paddingVertical: 2, fontSize: 12, fontWeight: '700', color: color.tint, backgroundColor: mutedBackground }, scheduleItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: color.card, borderRadius: 14, marginBottom: 8 }, scheduleIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: mutedBackground, justifyContent: 'center', alignItems: 'center' }, scheduleCopy: { flex: 1, marginLeft: 11 }, scheduleDay: { fontSize: 14, fontWeight: '700', color: color.text }, scheduleTime: { fontSize: 13, color: color.textSecondary, marginTop: 2 }, removeButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: `${color.error}15`, alignItems: 'center', justifyContent: 'center' },
    primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: color.tint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }, primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' }, footer: { marginTop: 24 },
  });
};

export default CourseForm;
