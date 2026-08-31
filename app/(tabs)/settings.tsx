import React, { useContext, useState, useEffect } from 'react';
import { View, StyleSheet, Linking, ScrollView, useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { NotificationTimeModal } from '@/components/NotificationTimeModal';
import { useRouter } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { db, reopenDatabase, initDatabase, clearCourseColors } from '@/utils/database';
import {
  requestPermissions,
  scheduleCourseNotifications,
  cancelAllNotifications,
  setupNotificationChannels,
  cancelUpdateNotification,
} from '@/utils/notifications';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useCustomAlert } from '@/context/AlertContext';
import SettingsSection from '@/components/SettingsSection';
import SettingsButton from '@/components/SettingsButton';
import SettingsToggle from '@/components/SettingsToggle';
import SettingsSegmentedRow from '@/components/SettingsSegmentedRow';
import { CustomPicker } from '@/components/CustomPicker';

export default function SettingsScreen() {
  const {
    courses,
    skipDays,
    clearData,
    notificationTiming,
    updateNotificationTiming,
    notificationsEnabled,
    toggleNotifications,
    is24Hour,
    toggle24Hour,
    updateNotificationsEnabled,
    toggleUpdateNotifications,
    weekStartsOn,
    updateWeekStartsOn,
    save,
    loadData,
    settings,
    updateSetting,
  } = useContext(AppContext);

  const [isModalVisible, setModalVisible] = useState(false);
  const [defaultAttendanceStatus, setDefaultAttendanceStatus] = useState<'present' | 'absent' | 'cancelled'>('absent');
  const [latestVersion, setLatestVersion] = useState('');
  const [isWeekPickerVisible, setWeekPickerVisible] = useState(false);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    const fetchLatestVersion = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/SuperCoolPencil/GRAD/releases/latest');
        if (!response.ok) throw new Error(`Update check failed: ${response.status}`);
        const data = await response.json();
        setLatestVersion(data.tag_name);
      } catch (error) {
        console.error('Failed to fetch latest version:', error);
      }
    };

    fetchLatestVersion();
  }, []);

  useEffect(() => {
    if (settings.defaultAttendanceStatus) {
      setDefaultAttendanceStatus(settings.defaultAttendanceStatus as 'present' | 'absent' | 'cancelled');
    }
  }, [settings.defaultAttendanceStatus]);

  const handleDefaultStatusChange = (status: 'present' | 'absent' | 'cancelled') => {
    setDefaultAttendanceStatus(status);
    updateSetting('defaultAttendanceStatus', status);
  };

  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const activeColorScheme = colorScheme;
  const { showAlert } = useCustomAlert();

  const handleClearData = async () => {
    showAlert(
      'Clear All Data',
      'Are you sure you want to clear all data? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            await clearData();
            showAlert('Data Cleared', 'All application data has been removed.');
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    await save();
    db.closeSync();

    const dbUri = FileSystem.documentDirectory + 'SQLite/grad.db';
    const fileInfo = await FileSystem.getInfoAsync(dbUri);
    if (!fileInfo.exists) {
      showAlert('Error', 'Database file not found.');
      reopenDatabase();
      return;
    }

    try {
      await Sharing.shareAsync(dbUri);
    } catch {
      showAlert('Error', 'Failed to share the database file.');
    } finally {
      reopenDatabase();
    }
  };

  const handleImportData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream',
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const dbPath = FileSystem.documentDirectory + 'SQLite/grad.db';

        db.closeSync();

        await FileSystem.copyAsync({
          from: fileUri,
          to: dbPath,
        });

        reopenDatabase();
        initDatabase();
        if (loadData) {
          loadData();
        }

        showAlert('Success', 'Database imported successfully. Please restart the app if you encounter any issues.');
      }
    } catch (error) {
      console.error('Failed to import database:', error);
      showAlert('Error', 'Failed to import the database file.');
      reopenDatabase();
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
          await scheduleCourseNotifications(course, notificationTiming, skipDays);
        }
      }
    } else {
      await cancelAllNotifications();
    }
  };

  const handleUpdateNotificationToggle = async () => {
    toggleUpdateNotifications();
    if (!updateNotificationsEnabled) {
      await requestPermissions();
    } else {
      await cancelUpdateNotification();
    }
  };

  const hasUpdate = latestVersion && latestVersion !== `v${Constants.expoConfig?.version}`;

  return (
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Settings</ThemedText>
      </ThemedView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Section 1: Preferences */}
        <SettingsSection title="Preferences">
          <SettingsToggle
            title="24-Hour Clock"
            subtitle="Display time in 24-hour format"
            iconName="time-outline"
            value={is24Hour}
            onValueChange={toggle24Hour}
          />
          <SettingsButton
            title="Start of Week"
            subtitle="First day shown on timetables"
            value={daysOfWeek[weekStartsOn]}
            iconName="calendar-outline"
            onPress={() => setWeekPickerVisible(true)}
          />
          <SettingsSegmentedRow
            title="Default Attendance Status"
            iconName="checkmark-circle-outline"
            value={defaultAttendanceStatus}
            onValueChange={handleDefaultStatusChange}
            options={[
              { label: 'Present', value: 'present', activeColor: Colors[activeColorScheme].success },
              { label: 'Absent', value: 'absent', activeColor: Colors[activeColorScheme].error },
              { label: 'Cancelled', value: 'cancelled', activeColor: Colors[activeColorScheme].icon },
            ]}
          />
        </SettingsSection>

        {/* Section 2: Notifications */}
        <SettingsSection title="Notifications">
          <SettingsToggle
            title="Class Notifications"
            subtitle="Get reminders before or after classes"
            iconName="notifications-outline"
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
          />
          {notificationsEnabled && (
            <SettingsButton
              title="Notification Timing"
              value={`${notificationTiming.value} mins ${
                notificationTiming.anchor === 'before_start'
                  ? 'before start'
                  : notificationTiming.anchor === 'after_start'
                  ? 'after start'
                  : 'after end'
              }`}
              iconName="timer-outline"
              onPress={() => setModalVisible(true)}
            />
          )}
          <SettingsToggle
            title="App Update Notifications"
            subtitle="Notify when new versions are available"
            iconName="cloud-download-outline"
            value={updateNotificationsEnabled}
            onValueChange={handleUpdateNotificationToggle}
          />
        </SettingsSection>

        {/* Section 3: Data & Storage */}
        <SettingsSection title="Data & Storage">
          <SettingsButton
            title="Manage Holidays"
            subtitle="Set institution breaks and non-class dates"
            iconName="calendar-clear-outline"
            onPress={() => router.push('/manage-holidays')}
          />
          <SettingsButton
            title="View Archived Courses"
            subtitle="Browse past or inactive courses"
            iconName="archive-outline"
            onPress={() => router.push('/archived-courses')}
          />
          <SettingsButton
            title="Export Database"
            subtitle="Backup your attendance data"
            iconName="download-outline"
            onPress={handleExportData}
          />
          <SettingsButton
            title="Import Database"
            subtitle="Restore from a saved database file"
            iconName="cloud-upload-outline"
            onPress={handleImportData}
          />
          <SettingsButton
            title="Refresh Course Colors"
            subtitle="Re-assign theme colors to courses"
            iconName="refresh-outline"
            onPress={() => {
              clearCourseColors();
              if (loadData) {
                loadData();
              }
              showAlert('Colors Refreshed', 'Course colors have been updated.');
            }}
          />
          <SettingsButton
            title="Clear All Data"
            subtitle="Permanently erase all courses and records"
            iconName="trash-outline"
            isDestructive
            onPress={handleClearData}
          />
        </SettingsSection>

        {/* Section 4: About & Support */}
        <SettingsSection title="About & Support">
          <SettingsButton
            title="App Version"
            value={`v${Constants.expoConfig?.version || '1.0.0'}`}
            iconName="information-circle-outline"
            isInformational
          />
          {hasUpdate && (
            <SettingsButton
              title="Update Available"
              value={latestVersion}
              iconName="arrow-up-circle-outline"
              iconColor={Colors[colorScheme].tint}
              onPress={() => Linking.openURL('https://github.com/SuperCoolPencil/GRAD/releases/latest')}
            />
          )}
          <SettingsButton
            title="GitHub Repository"
            subtitle="Source code and issue tracker"
            iconName="logo-github"
            onPress={() => Linking.openURL('https://github.com/SuperCoolPencil/GRAD')}
          />
          <SettingsButton
            title="Contact Us"
            subtitle="Send feedback or report bugs"
            iconName="mail-outline"
            onPress={() => Linking.openURL('mailto:thesupercoolpencil@gmail.com')}
          />
        </SettingsSection>

        {/* Notification Time Modal */}
        <NotificationTimeModal
          isVisible={isModalVisible}
          onClose={() => setModalVisible(false)}
          onSave={(timing) => {
            updateNotificationTiming(timing);
            setModalVisible(false);
          }}
          initialTiming={notificationTiming}
        />

        {/* Start of Week Picker Modal */}
        {isWeekPickerVisible && (
          <CustomPicker
            label=""
            isVisible={isWeekPickerVisible}
            onClose={() => setWeekPickerVisible(false)}
            selectedValue={weekStartsOn}
            onValueChange={(value) => {
              updateWeekStartsOn(value as 0 | 1 | 2 | 3 | 4 | 5 | 6);
            }}
            options={daysOfWeek.map((day, index) => ({ label: day, value: index as 0 | 1 | 2 | 3 | 4 | 5 | 6 }))}
            modalTitle="Select Start Day of Week"
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 64,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
});
