import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, useColorScheme } from 'react-native';
import { ThemedText } from './ThemedText';
import { BaseModal } from './BaseModal';
import CustomSwitch from './CustomSwitch';
import { Course } from '@/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';

interface ConfigurationModalProps {
  isVisible: boolean;
  onClose: () => void;
  course: Course;
  onUpdateCourse: (updatedCourse: Course) => void;
}

export default function ConfigurationModal({
  isVisible,
  onClose,
  course,
  onUpdateCourse,
}: ConfigurationModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [tempCourse, setTempCourse] = useState(course);

  useEffect(() => {
    setTempCourse(course);
  }, [course]);

  const handleSave = () => {
    onUpdateCourse(tempCourse);
    onClose();
  };

  const primaryColor = useThemeColor({}, 'alertPrimary');
  const tintColor = useThemeColor({}, 'tint');

  const footerContent = (
    <View style={styles.buttonRow}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.cancelButton,
          { borderColor: tintColor, opacity: pressed ? 0.75 : 1 },
        ]}
        onPress={onClose}
      >
        <ThemedText style={[styles.buttonText, { color: tintColor }]}>
          Cancel
        </ThemedText>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: primaryColor, opacity: pressed ? 0.75 : 1 },
        ]}
        onPress={handleSave}
      >
        <ThemedText style={[styles.buttonText, { color: '#fff', fontWeight: 'bold' }]}>
          Save
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title="Course Configuration"
      subtitle={course.name}
      showCloseButton={true}
      dismissOnBackdropPress={true}
      footer={footerContent}
    >
      <View style={styles.container}>
        {tempCourse.createdAt && (
          <View style={styles.infoRow}>
            <View style={styles.infoLabelGroup}>
              <Ionicons name="calendar-outline" size={18} color={Colors[colorScheme].icon} />
              <ThemedText style={styles.infoText}>Created on</ThemedText>
            </View>
            <ThemedText type="defaultSemiBold" style={styles.infoValue}>
              {new Date(tempCourse.createdAt).toLocaleDateString()}
            </ThemedText>
          </View>
        )}

        {tempCourse.archivedAt && (
          <View style={styles.infoRow}>
            <View style={styles.infoLabelGroup}>
              <Ionicons name="archive-outline" size={18} color={Colors[colorScheme].icon} />
              <ThemedText style={styles.infoText}>Archived on</ThemedText>
            </View>
            <ThemedText type="defaultSemiBold" style={styles.infoValue}>
              {new Date(tempCourse.archivedAt).toLocaleDateString()}
            </ThemedText>
          </View>
        )}

        <View style={styles.configRow}>
          <ThemedText type="defaultSemiBold">Show in Tracker</ThemedText>
          <CustomSwitch
            value={Boolean(tempCourse.showInTracker)}
            onValueChange={(newValue) =>
              setTempCourse({ ...tempCourse, showInTracker: newValue })
            }
          />
        </View>

        <View style={styles.configRow}>
          <ThemedText type="defaultSemiBold">Show in Heatmap</ThemedText>
          <CustomSwitch
            value={Boolean(tempCourse.showInHeatmap)}
            onValueChange={(newValue) =>
              setTempCourse({ ...tempCourse, showInHeatmap: newValue })
            }
          />
        </View>

        <View style={[styles.configRow, styles.lastRow]}>
          <ThemedText type="defaultSemiBold">Show in Radar</ThemedText>
          <CustomSwitch
            value={Boolean(tempCourse.showInRadar)}
            onValueChange={(newValue) =>
              setTempCourse({ ...tempCourse, showInRadar: newValue })
            }
          />
        </View>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.8,
  },
  infoValue: {
    fontSize: 14,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
