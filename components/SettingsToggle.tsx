import React from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import { useTheme } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import CustomSwitch from './CustomSwitch'; // Import CustomSwitch

type SettingsToggleProps = {
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export default function SettingsToggle({ title, iconName, value, onValueChange }: SettingsToggleProps) {
  const { colors } = useTheme();
  const colorScheme = useColorScheme();

  const backgroundColor = colorScheme === 'dark' ? Colors.dark.card : Colors.light.card;
  const textColor = colorScheme === 'dark' ? Colors.dark.text : Colors.light.text;
  const iconColor = colorScheme === 'dark' ? Colors.dark.text : Colors.light.text;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        <Ionicons name={iconName} size={20} color={iconColor} style={styles.icon} />
        <ThemedText style={[styles.title, { color: textColor }]}>{title}</ThemedText>
        <CustomSwitch value={value} onValueChange={onValueChange} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
});
