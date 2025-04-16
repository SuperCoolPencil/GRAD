import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native'; // Import Platform, removed useColorScheme
import Constants from 'expo-constants'; // Import Constants
import { Link, useRouter } from 'expo-router';
import { ExternalLink } from '@/components/ExternalLink'; // Adjusted path
import { AppContext } from '@/context/AppContext'; // Adjusted path
import { ThemedText } from '@/components/ThemedText'; // Added for consistency
import { ThemedView } from '@/components/ThemedView'; // Added for consistency
import { Colors } from '@/constants/Colors'; // Added for consistency
import { useTheme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { useCustomAlert } from '@/context/AlertContext'; // Import the custom alert hook
import Ionicons from '@expo/vector-icons/Ionicons';

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
        { text: "OK", 
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
          <ExternalLink
            href="mailto:thesupercoolpencil@gmail.com"
            style={styles.linkText}
          >
            <Ionicons name="mail-outline" size={20} color={colors.text} style={{ marginRight: 5 }} />
            <ThemedText style={styles.linkText}>thesupercoolpencil@gmail.com</ThemedText>
          </ExternalLink>
        </View>

        {/* Project Section */}
        <View style={styles.sectionContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Project</ThemedText>
          <ExternalLink
            href="https://github.com/SuperCoolPencil/GRAD"
            style={styles.linkText}
          >
            <Ionicons name="logo-github" size={20} color={colors.text} style={{ marginRight: 5 }} />
            <ThemedText style={styles.linkText}>GitHub Repository</ThemedText>
          </ExternalLink>
        </View>

        {/* Data Section */}
        <View style={styles.sectionContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Data Management</ThemedText>
          {/* Add Link to Archived Courses */}
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: colorScheme === 'dark' ? Colors.dark.tint : Colors.light.tint }]}
            onPress={() => {
              router.push("/archived-courses");
            }}
          >
            <Ionicons name="archive-outline" size={20} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.clearButtonText}>View Archived Courses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: colorScheme === 'dark' ? Colors.dark.error : Colors.light.error }]}
            onPress={handleClearData}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.clearButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    // Use paddingTop instead of marginTop to account for status bar
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight + 64 : 16, 
    paddingBottom: 16, // Reduced bottom padding for title
    backgroundColor: 'transparent', // Ensure background color doesn't interfere
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8, // Start content closer to title
  },
  sectionContainer: {
    marginBottom: 24, // Increased spacing between sections
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    marginBottom: 12, // Spacing below section title
    fontSize: 18, // Slightly smaller subtitle
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8, // Add padding for better touch area
  },
  settingLabel: {
    fontSize: 16,
  },
  linkText: {
    fontSize: 16,
    paddingVertical: 4, // Add padding for better touch area
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8, // Add margin top for spacing
  },
  clearButtonText: {
    color: '#fff', // White text for button
    fontSize: 16,
    fontWeight: 'bold',
  },
});
