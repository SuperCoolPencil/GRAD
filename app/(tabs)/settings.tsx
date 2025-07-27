import React, { useContext, useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Linking, Switch, TextInput, Button, ScrollView, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker'; // Import DocumentPicker
import NotificationTimeModal from '@/components/NotificationTimeModal';
import { useRouter } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { db, reopenDatabase, clearCourseColors } from '@/utils/database';
import {
  requestPermissions,
  scheduleCourseNotifications,
  cancelAllNotifications,
  setupNotificationChannels,
} from '@/utils/notifications';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { useCustomAlert } from '@/context/AlertContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import SettingsButton from '@/components/SettingsButton';

export default function SettingsScreen() {
  const { courses, clearData, notificationTime, updateNotificationTime, notificationsEnabled, toggleNotifications, is24Hour, toggle24Hour, save, reloadData, settings, updateSetting } = useContext(AppContext); // Added reloadData
  const [isModalVisible, setModalVisible] = useState(false);
  const [defaultAttendanceStatus, setDefaultAttendanceStatus] = useState('absent');

  useEffect(() => {
    if (settings.defaultAttendanceStatus) {
      setDefaultAttendanceStatus(settings.defaultAttendanceStatus);
    }
  }, [settings.defaultAttendanceStatus]);

  const handleDefaultStatusChange = (status: 'present' | 'absent' | 'cancelled') => {
    setDefaultAttendanceStatus(status);
    updateSetting('defaultAttendanceStatus', status);
  };
  const router = useRouter();
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const { showAlert } = useCustomAlert(); // Use the custom alert hook

  const handleClearData = async () => {
    showAlert(
      "Clear All Data",
      "Are you sure you want to clear all data? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "OK",
          style: "destructive",
          onPress: async () => {
            await clearData();
            showAlert("Data Cleared", "All application data has been removed.");
          }
        }
      ]
    );
  };

  const handleExportData = async () => {
    await save(); // Ensure all data is saved before exporting
    
    // Close the database to ensure all data is written to the file
    db.closeSync();

    const dbUri = FileSystem.documentDirectory + 'SQLite/grad.db';
    const fileInfo = await FileSystem.getInfoAsync(dbUri);
    if (!fileInfo.exists) {
      showAlert("Error", "Database file not found.");
      reopenDatabase(); // Reopen the database even if sharing fails
      return;
    }
    
    try {
      await Sharing.shareAsync(dbUri);
    } catch (error) {
      showAlert("Error", "Failed to share the database file.");
    } finally {
      reopenDatabase(); // Reopen the database after sharing is complete
    }
  };

  const handleImportData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream', // For .db files
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const dbPath = FileSystem.documentDirectory + 'SQLite/grad.db';

        // Close the current database connection
        db.closeSync();

        // Overwrite the existing database file
        await FileSystem.copyAsync({
          from: fileUri,
          to: dbPath,
        });

        // Reopen the database and reload data
        reopenDatabase();
        if (reloadData) {
          reloadData();
        }

        showAlert("Success", "Database imported successfully. Please restart the app if you encounter any issues.");
      }
    } catch (error) {
      console.error("Failed to import database:", error);
      showAlert("Error", "Failed to import the database file.");
      reopenDatabase(); // Reopen the database even if import fails
    }
  };

  useEffect(() => {
    setupNotificationChannels();
  }, []);

  const handleNotificationToggle = async () => {
    toggleNotifications();
    if (!notificationsEnabled) {
      await requestPermissions();
      await cancelAllNotifications();
      for (const course of courses) {
        if (!course.isArchived) {
          await scheduleCourseNotifications(course, notificationTime);
        }
      }
    } else {
      await cancelAllNotifications();
    }
  };


  return (
    <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">
          Settings
        </ThemedText>
      </ThemedView>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Contact Us Section */}
        <View style={styles.sectionContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Contact Us</ThemedText>
          <SettingsButton
            onPress={() => Linking.openURL('mailto:thesupercoolpencil@gmail.com')}
            title="thesupercoolpencil@gmail.com"
            iconName="mail-outline"
            backgroundColor={colorScheme === 'dark' ? Colors.dark.card : Colors.light.card}
            textColor={colorScheme === 'dark' ? Colors.dark.text : Colors.light.text}
          />
        </View>

        {/* Project Section */}
        <View style={styles.sectionContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Project</ThemedText>
          <SettingsButton
            onPress={() => Linking.openURL('https://github.com/SuperCoolPencil/GRAD')}
            title="GitHub Repository"
            iconName="logo-github"
            backgroundColor={colorScheme === 'dark' ? Colors.dark.card : Colors.light.card}
            textColor={colorScheme === 'dark' ? Colors.dark.text : Colors.light.text}
          />
        </View>

        {/* Data Section */}
        <View style={styles.sectionContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Notifications</ThemedText>
          <View style={styles.notificationSetting}>
            <ThemedText>Enable Notifications</ThemedText>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
            />
          </View>
          {notificationsEnabled && (
            <SettingsButton
              onPress={() => setModalVisible(true)}
              title={`Notify ${notificationTime} minutes before class`}
              iconName="time-outline"
              backgroundColor={colorScheme === 'dark' ? Colors.dark.card : Colors.light.card}
              textColor={colorScheme === 'dark' ? Colors.dark.text : Colors.light.text}
            />
          )}
        </View>

        {/* General Section */}
        <View style={styles.sectionContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>General</ThemedText>
          <View style={styles.notificationSetting}>
            <ThemedText>24-Hour Clock</ThemedText>
            <Switch
              value={is24Hour}
              onValueChange={toggle24Hour}
            />
          </View>
          <ThemedText type="subtitle" style={{ marginTop: 16 }}>Default Attendance Status</ThemedText>
          <View style={styles.statusButtonsContainer}>
            <TouchableOpacity
              style={[styles.statusButton, defaultAttendanceStatus === 'present' && styles.selectedButton]}
              onPress={() => handleDefaultStatusChange('present')}
            >
              <ThemedText style={defaultAttendanceStatus === 'present' ? styles.selectedButtonText : {}}>Present</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusButton, defaultAttendanceStatus === 'absent' && styles.selectedButton]}
              onPress={() => handleDefaultStatusChange('absent')}
            >
              <ThemedText style={defaultAttendanceStatus === 'absent' ? styles.selectedButtonText : {}}>Absent</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusButton, defaultAttendanceStatus === 'cancelled' && styles.selectedButton]}
              onPress={() => handleDefaultStatusChange('cancelled')}
            >
              <ThemedText style={defaultAttendanceStatus === 'cancelled' ? styles.selectedButtonText : {}}>Cancelled</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <NotificationTimeModal
          isVisible={isModalVisible}
          onClose={() => setModalVisible(false)}
          onSave={(time) => {
            updateNotificationTime(time);
            setModalVisible(false);
          }}
          initialTime={notificationTime}
        />

        <View style={styles.sectionContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Data Management</ThemedText>
          <SettingsButton
            onPress={() => router.push("/archived-courses")}
            title="View Archived Courses"
            iconName="archive-outline"
            backgroundColor={colorScheme === 'dark' ? Colors.dark.tint : Colors.light.tint}
          />
          <SettingsButton
            onPress={handleExportData}
            title="Export Database"
            iconName="download-outline"
            backgroundColor={colorScheme === 'dark' ? Colors.dark.card : Colors.light.card}
            textColor={colorScheme === 'dark' ? Colors.dark.text : Colors.light.text}
          />
          <SettingsButton
            onPress={handleImportData}
            title="Import Database"
            iconName="cloud-upload-outline"
            backgroundColor={colorScheme === 'dark' ? Colors.dark.card : Colors.light.card}
            textColor={colorScheme === 'dark' ? Colors.dark.text : Colors.light.text}
          />
          <SettingsButton
            onPress={handleClearData}
            title="Clear All Data"
            iconName="trash-outline"
            backgroundColor={colorScheme === 'dark' ? Colors.dark.error : Colors.light.error}
          />
          <SettingsButton
            onPress={() => {
              clearCourseColors();
              if (reloadData) {
                reloadData();
              }
              showAlert("Colors Refreshed", "Course colors have been updated.");
            }}
            title="Refresh Course Colors"
            iconName="refresh-outline"
            backgroundColor={colorScheme === 'dark' ? Colors.dark.card : Colors.light.card}
            textColor={colorScheme === 'dark' ? Colors.dark.text : Colors.light.text}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  notificationSetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 64,
    backgroundColor: "transparent",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  sectionContainer: {
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    marginBottom: 12,
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statusButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  selectedButton: {
    backgroundColor: Colors.light.tint,
  },
  selectedButtonText: {
    color: '#fff',
  },
});
