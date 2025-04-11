import React, { useContext } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ExternalLink } from '../components/ExternalLink';
import { AppContext } from '../context/AppContext';
import { useThemeColor } from '../hooks/useThemeColor';

const Settings = () => {
  const { theme, toggleTheme, clearData } = useContext(AppContext);
  const textColor = useThemeColor({}, 'text');
  const background = useThemeColor({}, 'background');

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: background,
    },
    sectionContainer: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: textColor,
      marginBottom: 10,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    settingLabel: {
      fontSize: 16,
      color: textColor,
    },
  });

  const clearAllData = async () => {
    clearData();
    Alert.alert("Data cleared");
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Theme</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Dark Mode</Text>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
          />
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <ExternalLink
          href="mailto:thesupercoolpencil@gmail.com"
          style={styles.settingLabel}
        >
          thesupercoolpencil@gmail.com
        </ExternalLink>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Project</Text>
        <ExternalLink
          href="https://github.com/SuperCoolPencil/GRAD"
          style={styles.settingLabel}
        >
          GitHub Repository
        </ExternalLink>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Clear All Data</Text>
          <TouchableOpacity onPress={() => {
            Alert.alert(
              "Clear All Data",
              "Are you sure you want to clear all data?",
              [
                {
                  text: "Cancel",
                  style: "cancel"
                },
                { text: "OK", onPress: () => clearAllData() }
              ]
            );
          }}>
            <Text>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Settings;
