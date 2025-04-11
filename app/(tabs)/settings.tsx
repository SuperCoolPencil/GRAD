import React, { useContext } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert, useColorScheme, Platform } from 'react-native'; // Import Platform
import Constants from 'expo-constants'; // Import Constants
import { ExternalLink } from '@/components/ExternalLink'; // Adjusted path
import { AppContext } from '@/context/AppContext'; // Adjusted path
import { useThemeColor } from '@/hooks/useThemeColor'; // Adjusted path
import { ThemedText } from '@/components/ThemedText'; // Added for consistency
import { ThemedView } from '@/components/ThemedView'; // Added for consistency
import { Colors } from '@/constants/Colors'; // Added for consistency

export default function SettingsScreen() {
  const { theme, toggleTheme, clearData } = useContext(AppContext);
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={{ color: Colors[colorScheme].text }}>
          Settings
        </ThemedText>
      </ThemedView>
      <SettingsContent
        theme={theme as 'light' | 'dark'} // Cast theme to the expected type
        toggleTheme={toggleTheme}
        clearData={clearData as () => Promise<void>}
        colorScheme={colorScheme}
      />
    </View>
  );
}

function SettingsContent({ theme, toggleTheme, clearData, colorScheme }: { theme: 'light' | 'dark'; toggleTheme: () => void; clearData: () => Promise<void>; colorScheme: 'light' | 'dark' }) {
  const textColor = Colors[colorScheme].text;
  const tintColor = Colors[colorScheme].tint;
  const errorColor = Colors[colorScheme].error;

  const handleClearData = async () => {
    Alert.alert(
      "Clear All Data",
      "Are you sure you want to clear all data? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { text: "OK", onPress: async () => {
            await clearData();
            Alert.alert("Data Cleared", "All application data has been removed.");
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.contentContainer}>
      {/* Theme Section */}
      <View style={styles.sectionContainer}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Theme</ThemedText>
        <View style={styles.settingRow}>
          <ThemedText style={styles.settingLabel}>Dark Mode</ThemedText>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: tintColor }}
            thumbColor={theme === 'dark' ? Colors.dark.tint : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
          />
        </View>
      </View>

      {/* Contact Us Section */}
      <View style={styles.sectionContainer}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Contact Us</ThemedText>
        <ExternalLink
          href="mailto:thesupercoolpencil@gmail.com"
          style={styles.linkText}
        >
          <ThemedText style={[styles.linkText, { color: tintColor }]}>thesupercoolpencil@gmail.com</ThemedText>
        </ExternalLink>
      </View>

      {/* Project Section */}
      <View style={styles.sectionContainer}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Project</ThemedText>
        <ExternalLink
          href="https://github.com/SuperCoolPencil/GRAD"
          style={styles.linkText}
        >
          <ThemedText style={[styles.linkText, { color: tintColor }]}>GitHub Repository</ThemedText>
        </ExternalLink>
      </View>

      {/* Data Section */}
      <View style={styles.sectionContainer}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Data Management</ThemedText>
        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: errorColor }]}
          onPress={handleClearData}
        >
          <Text style={styles.clearButtonText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>
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
