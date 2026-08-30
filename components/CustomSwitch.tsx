import React from 'react';
import { TouchableOpacity, View, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

type CustomSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export default function CustomSwitch({ value, onValueChange, disabled = false }: CustomSwitchProps) {
  const colorScheme = useColorScheme() || 'light';

  const trackColor = value ? Colors[colorScheme].tint : Colors[colorScheme].textSecondary;
  const thumbColor = Colors[colorScheme].white;
  const thumbStyle = value ? styles.thumbOn : styles.thumbOff;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={disabled ? styles.disabled : null}
    >
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.thumb, { backgroundColor: thumbColor }, thumbStyle]} />
      </View>
    </TouchableOpacity>
  );
}

const trackWidth = 50;
const trackHeight = 28;
const thumbSize = 24;

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  track: {
    width: trackWidth,
    height: trackHeight,
    borderRadius: trackHeight / 2,
    justifyContent: 'center',
    padding: 2,
  },
  thumb: {
    width: thumbSize,
    height: thumbSize,
    borderRadius: thumbSize / 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  thumbOff: {
    alignSelf: 'flex-start',
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
});
