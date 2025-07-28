import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, Modal, FlatList, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ThemedText } from '@/components/ThemedText';
import { Course } from '@/types';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@react-navigation/native';

interface CoursePickerProps {
  label?: string;
  courses: Course[];
  selectedCourseIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  multiSelect?: boolean;
  allCoursesOption?: boolean;
  showArchivedToggle?: boolean;
  showSaveButton?: boolean;
}

export const CoursePicker = ({
  label = 'Course:',
  courses,
  selectedCourseIds,
  onSelectionChange,
  multiSelect = true,
  allCoursesOption = true,
  showArchivedToggle = false,
  showSaveButton = false,
}: CoursePickerProps) => {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { colors } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const styles = useMemo(() => getStyles(colors, colorScheme), [colors, colorScheme]);

  const handleItemPress = (courseId: string | null) => {
    if (multiSelect) {
      if (courseId === null) { // "All Courses" selected
        // Select all currently filtered courses
        onSelectionChange(filteredCourses.map(c => c.id!));
      } else {
        onSelectionChange(
          selectedCourseIds.includes(courseId)
            ? selectedCourseIds.filter((id: string) => id !== courseId)
            : [...selectedCourseIds, courseId]
        );
      }
    } else {
      onSelectionChange(courseId === null ? [] : [courseId]);
      setIsPickerVisible(false);
    }
  };

  const displayValue = useMemo(() => {
    if (allCoursesOption && selectedCourseIds.length === 0) {
      return 'All Courses';
    }
    if (multiSelect) {
      return `${selectedCourseIds.length} course(s) selected`;
    }
    const selectedCourse = courses.find(c => c.id === selectedCourseIds[0]);
    return selectedCourse?.name ?? 'Select a course...';
  }, [selectedCourseIds, courses, multiSelect, allCoursesOption]);

  const filteredCourses = useMemo(() => {
    return showArchived ? courses : courses.filter(course => !course.isArchived);
  }, [courses, showArchived]);

  const data = useMemo(() => {
    const courseList = [...filteredCourses];
    if (allCoursesOption) {
      return [{ id: null, name: 'All Courses' } as unknown as Course, ...courseList];
    }
    return courseList;
  }, [filteredCourses, allCoursesOption]);

  return (
    <View style={styles.inputGroup}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TouchableOpacity style={styles.pickerTrigger} onPress={() => setIsPickerVisible(true)}>
        <ThemedText style={styles.pickerTriggerText}>{displayValue}</ThemedText>
        <Ionicons name="chevron-down" size={20} color={colors.text} />
      </TouchableOpacity>
      <Modal
        transparent={true}
        visible={isPickerVisible}
        animationType="fade"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <BlurView intensity={25} style={styles.blurView} tint="dark">
          <TouchableOpacity
            style={styles.modalContainer}
            activeOpacity={1}
            onPressOut={() => setIsPickerVisible(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              {showArchivedToggle && (
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setShowArchived(prev => !prev)}
                >
                  <Ionicons
                    name={showArchived ? 'checkbox-outline' : 'square-outline'}
                    size={24}
                    color={Colors[colorScheme].tint}
                    style={{ marginRight: 10 }}
                  />
                  <ThemedText style={styles.modalItemText}>Show Archived Courses</ThemedText>
                </TouchableOpacity>
              )}
              <FlatList
                data={data}
                keyExtractor={(item) => item.id || 'all-courses'}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isAllCoursesSelected = item.id === null && selectedCourseIds.length === filteredCourses.length && filteredCourses.every(fc => selectedCourseIds.includes(fc.id!));
                  const isItemSelected = item.id !== null && selectedCourseIds.includes(item.id);

                  return (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={() => handleItemPress(item.id)}
                    >
                      <Ionicons
                        name={
                          (item.id === null && isAllCoursesSelected) ||
                          (item.id !== null && isItemSelected)
                            ? 'checkmark-circle'
                            : 'ellipse-outline'
                        }
                        size={24}
                        color={
                          ((item.id === null && isAllCoursesSelected) ||
                          (item.id !== null && isItemSelected))
                            ? Colors[colorScheme].tint
                            : colors.text
                        }
                        style={{ marginRight: 10 }}
                      />
                      <ThemedText style={styles.modalItemText}>{item.name}</ThemedText>
                    </TouchableOpacity>
                  );
                }}
              />
              {(multiSelect || showSaveButton) && (
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsPickerVisible(false)}
                >
                  <ThemedText style={styles.modalCloseButtonText}>
                    {multiSelect ? 'Save' : 'Close'}
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </View>
  );
};

const getStyles = (colors: any, colorScheme: 'light' | 'dark') => StyleSheet.create({
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
    color: colors.text,
  },
  pickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: colors.border,
    backgroundColor: Colors[colorScheme].inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    height: 50,
  },
  pickerTriggerText: {
    fontSize: 16,
    color: colors.text,
  },
  blurView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: 16,
    color: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseButton: {
    backgroundColor: Colors[colorScheme].tint,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
