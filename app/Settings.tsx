import React, { useContext } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { ExternalLink } from '../components/ExternalLink';
import { AppContext } from '../context/AppContext';
import { useThemeColor } from '../hooks/useThemeColor';

const Settings = () => {
  const { theme, toggleTheme } = useContext(AppContext);
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
          contact@example.com
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
    </View>
  );
};

export default Settings;
