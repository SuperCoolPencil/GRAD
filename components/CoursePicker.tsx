import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, FlatList, StyleSheet, useColorScheme, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { BaseModal } from '@/components/BaseModal';
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

  const handleItemPress = (courseId: string | null) => {
    if (multiSelect) {
      if (courseId === null) {
        // An empty selection is the query's canonical "all courses" value. Keeping
        // it that way also means the archived toggle only affects the picker UI.
        onSelectionChange([]);
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
    const selectedCourse = courses.find((c) => c.id === selectedCourseIds[0]);
    return selectedCourse?.name ?? 'Select a course...';
  }, [selectedCourseIds, courses, multiSelect, allCoursesOption]);

  const filteredCourses = useMemo(() => {
    return showArchived ? courses : courses.filter((course) => !course.isArchived);
  }, [courses, showArchived]);

  const data = useMemo(() => {
    const courseList = [...filteredCourses];
    if (allCoursesOption) {
      return [{ id: null, name: 'All Courses' } as unknown as Course, ...courseList];
    }
    return courseList;
  }, [filteredCourses, allCoursesOption]);

  const footerContent = (multiSelect || showSaveButton) ? (
    <Pressable
      style={({ pressed }) => [
        styles.saveButton,
        { backgroundColor: Colors[colorScheme].tint, opacity: pressed ? 0.75 : 1 },
      ]}
      onPress={() => setIsPickerVisible(false)}
    >
      <ThemedText style={styles.saveButtonText}>
        {multiSelect ? 'Save Selection' : 'Done'}
      </ThemedText>
    </Pressable>
  ) : undefined;

  return (
    <View style={styles.inputGroup}>
      {label !== '' && <ThemedText style={[styles.label, { color: colors.text }]}>{label}</ThemedText>}
      <TouchableOpacity
        style={[
          styles.pickerTrigger,
          {
            borderColor: colors.border,
            backgroundColor: Colors[colorScheme].inputBackground,
          },
        ]}
        onPress={() => setIsPickerVisible(true)}
      >
        <ThemedText style={[styles.pickerTriggerText, { color: colors.text }]}>
          {displayValue}
        </ThemedText>
        <Ionicons name="chevron-down" size={20} color={colors.text} />
      </TouchableOpacity>

      <BaseModal
        isVisible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        title="Select Course"
        showCloseButton={true}
        dismissOnBackdropPress={true}
        footer={footerContent}
      >
        <View style={styles.modalContent}>
          {showArchivedToggle && (
            <TouchableOpacity
              style={[styles.toggleRow, { borderBottomColor: Colors[colorScheme].separator }]}
              onPress={() => setShowArchived((prev) => !prev)}
            >
              <Ionicons
                name={showArchived ? 'checkbox-outline' : 'square-outline'}
                size={20}
                color={Colors[colorScheme].tint}
                style={{ marginRight: 10 }}
              />
              <ThemedText style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                Show Archived Courses
              </ThemedText>
            </TouchableOpacity>
          )}
          <FlatList
            data={data}
            keyExtractor={(item) => item.id || 'all-courses'}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            renderItem={({ item }) => {
              const isAllCoursesSelected =
                item.id === null &&
                (selectedCourseIds.length === 0 ||
                  (selectedCourseIds.length === filteredCourses.length &&
                    filteredCourses.every((fc) => selectedCourseIds.includes(fc.id!))));
              const isItemSelected = item.id !== null && selectedCourseIds.includes(item.id);

              return (
                <TouchableOpacity
                  style={[styles.modalItem, { borderBottomColor: Colors[colorScheme].separator }]}
                  onPress={() => handleItemPress(item.id)}
                >
                  <Ionicons
                    name={
                      (item.id === null && isAllCoursesSelected) ||
                      (item.id !== null && isItemSelected)
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={20}
                    color={
                      (item.id === null && isAllCoursesSelected) ||
                      (item.id !== null && isItemSelected)
                        ? Colors[colorScheme].tint
                        : Colors[colorScheme].icon
                    }
                    style={{ marginRight: 12 }}
                  />
                  <ThemedText
                    style={[
                      styles.modalItemText,
                      { color: colors.text },
                      ((item.id === null && isAllCoursesSelected) ||
                        (item.id !== null && isItemSelected)) && styles.selectedText,
                    ]}
                  >
                    {item.name}
                  </ThemedText>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </BaseModal>
    </View>
  );
};

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    marginBottom: 8,
    fontWeight: '500',
  },
  pickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 48,
  },
  pickerTriggerText: {
    fontSize: 14,
  },
  modalContent: {},
  list: {
    maxHeight: 320,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: 14,
  },
  selectedText: {
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
