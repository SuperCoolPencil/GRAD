import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Switch, useColorScheme } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import { useTheme } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';

type SettingsButtonProps = {
  label: string;
  value: boolean | undefined;
  onValueChange: (value: boolean) => void;
};

export default function SettingsButton({ label, value, onValueChange }: SettingsButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: Colors[colorScheme].tint }}
        thumbColor={'#f4f3f4'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
  },
});
