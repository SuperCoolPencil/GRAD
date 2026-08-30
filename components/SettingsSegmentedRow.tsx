import React from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';

interface SegmentOption<T extends string> {
  label: string;
  value: T;
  activeColor: string;
}

interface SettingsSegmentedRowProps<T extends string> {
  title: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  value: T;
  options: SegmentOption<T>[];
  onValueChange: (value: T) => void;
}

export default function SettingsSegmentedRow<T extends string>({
  title,
  iconName,
  value,
  options,
  onValueChange,
}: SettingsSegmentedRowProps<T>) {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {iconName ? (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: 'rgba(0, 150, 255, 0.1)' },
            ]}
          >
            <Ionicons name={iconName} size={18} color={Colors[colorScheme].tint} />
          </View>
        ) : null}
        <ThemedText style={styles.title}>{title}</ThemedText>
      </View>

      <View
        style={[
          styles.segmentedTrack,
          { backgroundColor: Colors[colorScheme].cardBackground },
        ]}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.8}
              onPress={() => onValueChange(option.value)}
              style={[
                styles.segmentButton,
                isSelected && {
                  backgroundColor: option.activeColor,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  elevation: 2,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.segmentText,
                  {
                    color: isSelected
                      ? '#FFFFFF'
                      : Colors[colorScheme].textSecondary,
                    fontWeight: isSelected ? '600' : '400',
                  },
                ]}
              >
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
  },
  segmentedTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 13,
  },
});
