import React, { useContext } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ExternalLink } from '../components/ExternalLink';
import { AppContext } from '../context/AppContext';
import { useThemeColor } from '../hooks/useThemeColor';

const Settings = () => {
  const { theme, toggleTheme, clearData } = useContext(AppContext);
  const textColor = useThemeColor({}, 'text');
  const background = useThemeColor({}, 'background');

  const clearAllData = async () => {
    await clearData();
    Alert.alert("Data cleared");
  };

  return (
    <View style={{
      flex: 1,
      padding: 20,
      backgroundColor: background,
    }}>
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
          href="mailto:thesupercoolpencil@gmail.com"
          style={{
            fontSize: 16,
            color: textColor,
          }}
        >
          thesupercoolpencil@gmail.com
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

      <View style={{
        marginBottom: 20,
      }}>
        <Text style={{
          fontSize: 20,
          fontWeight: 'bold',
          color: textColor,
          marginBottom: 10,
        }}>Data</Text>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}>
          <TouchableOpacity
            style={{
              backgroundColor: 'red',
              padding: 10,
              borderRadius: 5,
            }}
            onPress={() => {
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
            }}
          >
            <Text style={{
              color: 'white',
              fontSize: 16,
              fontWeight: 'bold',
              textAlign: 'center',
            }}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Settings;
