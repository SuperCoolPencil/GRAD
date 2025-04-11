import React, { useState, useContext } from 'react';
import { StyleSheet, View, TouchableOpacity, Platform, Modal, Text, Switch } from 'react-native';
import { ThemedText } from './ThemedText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'react-native';
import { ExternalLink } from './ExternalLink';
import { AppContext } from '../context/AppContext';
import { useThemeColor } from '../hooks/useThemeColor';

const TopBar = () => {
  const colorScheme = useColorScheme();
  const [modalVisible, setModalVisible] = useState(false);
  const { theme, toggleTheme } = useContext(AppContext);
  const textColor = useThemeColor({}, 'text');
  const background = useThemeColor({}, 'background');

  const stylesWithTheme = StyleSheet.create({
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
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: background,
      padding: 20,
      borderRadius: 10,
      width: '80%',
    },
  });

  return (
    <View style={[styles.topBar, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F2F2F2' }]}>
      <ThemedText style={styles.appName}>GRAD</ThemedText>
      <TouchableOpacity onPress={() => setModalVisible(true)}>
        <Ionicons name="settings-outline" size={28} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={stylesWithTheme.modalContainer}>
          <View style={stylesWithTheme.modalContent}>
            <Text style={stylesWithTheme.sectionTitle}>Settings</Text>

            <View style={stylesWithTheme.sectionContainer}>
              <Text style={stylesWithTheme.sectionTitle}>Theme</Text>
              <View style={stylesWithTheme.settingRow}>
                <Text style={stylesWithTheme.settingLabel}>Dark Mode</Text>
                <Switch
                  value={theme === 'dark'}
                  onValueChange={toggleTheme}
                />
              </View>
            </View>

            <View style={stylesWithTheme.sectionContainer}>
              <Text style={stylesWithTheme.sectionTitle}>Contact Us</Text>
              <ExternalLink
                href="mailto:contact@example.com"
                style={stylesWithTheme.settingLabel}
              >
                contact@example.com
              </ExternalLink>
            </View>

            <View style={stylesWithTheme.sectionContainer}>
              <Text style={stylesWithTheme.sectionTitle}>Project</Text>
              <ExternalLink
                href="https://github.com/your-username/your-repo"
                style={stylesWithTheme.settingLabel}
              >
                GitHub Repository
              </ExternalLink>
            </View>

            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setModalVisible(!modalVisible)}
            >
              <Text style={{ color: textColor, fontSize: 16, textAlign: 'center' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default TopBar;
