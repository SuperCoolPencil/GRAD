import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Switch, Modal, useColorScheme, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { BlurView } from 'expo-blur';
import { ThemedView } from './ThemedView';
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

export default function ConfigurationModal({ isVisible, onClose, course, onUpdateCourse }: ConfigurationModalProps) {
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
  const borderColor = useThemeColor({}, 'border');

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <BlurView intensity={25} style={StyleSheet.absoluteFill} tint="dark" />
          <ThemedView
            style={[styles.modalView, { borderColor }]}
            lightColor={Colors.light.alert}
            darkColor={Colors.dark.alert}
          >
            <ThemedText type="subtitle" style={styles.modalTitle}>Configuration</ThemedText>
            {tempCourse.createdAt && (
              <View style={styles.configRow}>
                <Ionicons name="calendar" size={18} color={Colors[colorScheme].icon} />
                <ThemedText style={styles.detailText} type="defaultSemiBold">
                  Created on: {new Date(tempCourse.createdAt).toLocaleDateString()}
                </ThemedText>
              </View>
            )}
            {tempCourse.archivedAt && (
              <View style={styles.configRow}>
                <Ionicons name="archive" size={18} color={Colors[colorScheme].icon} />
                <ThemedText style={styles.detailText} type="defaultSemiBold">
                  Archived on: {new Date(tempCourse.archivedAt).toLocaleDateString()}
                </ThemedText>
              </View>
            )}
            <View style={styles.configRow}>
              <ThemedText type="defaultSemiBold">Show in Tracker</ThemedText>
              <Switch
                value={tempCourse.showInTracker}
                onValueChange={(newValue) => {
                  setTempCourse({ ...tempCourse, showInTracker: newValue });
                }}
                trackColor={{ false: '#555', true: primaryColor }}
                thumbColor={tempCourse.showInTracker ? '#fff' : '#ddd'}
              />
            </View>
            <View style={[styles.configRow, { borderBottomWidth: 0 }]}>
              <ThemedText type="defaultSemiBold">Show in Heatmap</ThemedText>
              <Switch
                value={tempCourse.showInHeatmap}
                onValueChange={(newValue) => {
                  setTempCourse({ ...tempCourse, showInHeatmap: newValue });
                }}
                trackColor={{ false: '#555', true: primaryColor }}
                thumbColor={tempCourse.showInHeatmap ? '#fff' : '#ddd'}
              />
            </View>
            <View style={styles.buttonContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: 'transparent',
                    opacity: pressed ? 0.7 : 1,
                    borderWidth: 1,
                    borderColor: tintColor,
                    elevation: 0,
                  },
                ]}
                onPress={onClose}
              >
                <ThemedText style={[styles.buttonText, { color: tintColor, fontWeight: 'normal' }]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: primaryColor,
                    opacity: pressed ? 0.7 : 1,
                    elevation: 2,
                  },
                ]}
                onPress={handleSave}
              >
                <ThemedText style={[styles.buttonText, { color: '#fff', fontWeight: 'bold' }]}>Save</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  blurView: {
    flex: 1,
  },
  centeredView: {
    flex: 1,
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  detailText: {
    marginLeft: 4,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
