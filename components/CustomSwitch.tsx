import React from 'react';
import { TouchableOpacity, View, StyleSheet , useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors'; // Corrected import path

type CustomSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export default function CustomSwitch({ value, onValueChange }: CustomSwitchProps) {
  const colorScheme = useColorScheme() || 'light';
  
  // Define colors based on the switch's state (on/off)
  const trackColor = value ? Colors[colorScheme].tint : Colors[colorScheme].textSecondary;
  const thumbColor = Colors[colorScheme].white;

  // Determine the thumb's position
  const thumbStyle = value ? styles.thumbOn : styles.thumbOff;

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onValueChange(!value)}>
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
    elevation: 2, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
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
