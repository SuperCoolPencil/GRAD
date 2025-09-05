import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons'; // Import Ionicons
import { ThemedText } from './ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface AttendanceProgressRingProps {
  progress: number; // Value between 0 and 1
  color: string;
  size: number;
  strokeWidth: number;
  delta: number; // The delta number to display
}

const AttendanceProgressRing: React.FC<AttendanceProgressRingProps> = ({
  progress,
  color,
  size,
  strokeWidth,
  delta,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          stroke={Colors[colorScheme].separator} // Background circle color
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={color} // Progress circle color
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} // Start from top
        />
      </Svg>
      <View style={[StyleSheet.absoluteFillObject, styles.deltaTextContainer]}>
        {delta === 0 ? (
          <Ionicons name="checkmark-sharp" size={30} color={Colors[colorScheme].tint} />
        ) : (
          <ThemedText style={[styles.deltaText, { color: delta > 0 ? Colors[colorScheme].error : Colors[colorScheme].success }]}>
            {delta > 0 ? `${delta}` : Math.abs(delta)}
          </ThemedText>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  deltaTextContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  deltaText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default AttendanceProgressRing;
