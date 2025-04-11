import React, { useState, useContext, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Platform, Modal, Text, Switch } from 'react-native';
import { ThemedText } from './ThemedText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'react-native';
import { ExternalLink } from './ExternalLink';
import { AppContext } from '../context/AppContext';

const TopBar = () => {
  const colorScheme = useColorScheme();
  const [modalVisible, setModalVisible] = useState(false);
  const { theme, toggleTheme } = useContext(AppContext);

  const textColor = theme === 'dark' ? '#FFFFFF' : '#000000';
  const background = theme === 'dark' ? '#1E1E1E' : '#F2F2F2';

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
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}>
          <View style={{
            backgroundColor: background,
            padding: 20,
            borderRadius: 10,
            width: '80%',
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: textColor,
              marginBottom: 10,
            }}>Settings</Text>

            <View style={{
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: textColor,
                marginBottom: 10,
              }}>Theme</Text>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}>
                <Text style={{
                  fontSize: 16,
                  color: textColor,
                }}>Dark Mode</Text>
                <Switch
                  value={theme === 'dark'}
                  onValueChange={toggleTheme}
                />
              </View>
            </View>

            <View style={{
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: textColor,
                marginBottom: 10,
              }}>Contact Us</Text>
              <ExternalLink
                href="mailto:contact@example.com"
                style={{
                  fontSize: 16,
                  color: textColor,
                }}
              >
                contact@example.com
              </ExternalLink>
            </View>

            <View style={{
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: textColor,
                marginBottom: 10,
              }}>Project</Text>
              <ExternalLink
                href="https://github.com/SuperCoolPencil/GRAD"
                style={{
                  fontSize: 16,
                  color: textColor,
                }}
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
