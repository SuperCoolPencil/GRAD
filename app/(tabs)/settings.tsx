import React, { useContext } from 'react';
import { View, StyleSheet, Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { AppContext } from '@/context/AppContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { useCustomAlert } from '@/context/AlertContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import SettingsButton from '@/components/SettingsButton';

export default function SettingsScreen() {
  const { clearData } = useContext(AppContext);
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

  return (
    <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">
          Settings
        </ThemedText>
      </ThemedView>
      <ThemedView style={[styles.contentContainer, { backgroundColor: colors.background }]}>
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
          <ThemedText type="subtitle" style={styles.sectionTitle}>Data Management</ThemedText>
          <SettingsButton
            onPress={() => router.push("/archived-courses")}
            title="View Archived Courses"
            iconName="archive-outline"
            backgroundColor={colorScheme === 'dark' ? Colors.dark.tint : Colors.light.tint}
          />
          <SettingsButton
            onPress={handleClearData}
            title="Clear All Data"
            iconName="trash-outline"
            backgroundColor={colorScheme === 'dark' ? Colors.dark.error : Colors.light.error}
          />
        </View>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight + 64 : 32,
    backgroundColor: "transparent",
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionContainer: {
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
});
