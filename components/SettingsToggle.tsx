import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';
import CustomSwitch from './CustomSwitch';

type SettingsToggleProps = {
  title: string;
  subtitle?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export default function SettingsToggle({
  title,
  subtitle,
  iconName,
  iconColor,
  value,
  onValueChange,
  disabled = false,
}: SettingsToggleProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const defaultIconColor = iconColor || Colors[colorScheme].tint;

  return (
    <View style={styles.container}>
      <View style={styles.leftContent}>
        {iconName ? (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: 'rgba(0, 150, 255, 0.1)' },
            ]}
          >
            <Ionicons name={iconName} size={18} color={defaultIconColor} />
          </View>
        ) : null}
        <View style={styles.textContainer}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {subtitle ? (
            <ThemedText
              style={[
                styles.subtitle,
                { color: Colors[colorScheme].textSecondary },
              ]}
            >
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <CustomSwitch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
