import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';

interface TimeAxisProps {
  timeSlots: number[];
  styles: {
    timeAxis: object;
    timeLabel: object;
    timeText: object;
    timeLabelContainer: object;
  };
  is24Hour: boolean;
}

const TimeAxis: React.FC<TimeAxisProps> = ({ timeSlots, styles, is24Hour }) => {
  const formatHour = (hour: number) => {
    if (is24Hour) {
      return `${hour}`;
    }
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour} ${ampm}`;
  };

  return (
    <View style={styles.timeAxis}>
      {timeSlots.map(hour => (
        <View key={hour} style={styles.timeLabel}>
          <View style={styles.timeLabelContainer}>
            <ThemedText style={styles.timeText}>{formatHour(hour)}</ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
};

export default TimeAxis;
