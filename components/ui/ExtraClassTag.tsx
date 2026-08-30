import React from 'react';
import { StyleSheet, useColorScheme , StyleProp, ViewStyle } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';

interface ExtraClassTagProps {
  style?: StyleProp<ViewStyle>;
}

const ExtraClassTag: React.FC<ExtraClassTagProps> = ({ style }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const styles = getStyles(colorScheme);

  return (
    <ThemedView style={[styles.extraClassTagContainer, style]}>
      <ThemedText style={styles.extraClassTagText}>Extra</ThemedText>
    </ThemedView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  extraClassTagContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors[colorScheme].tint,
    borderRadius: 8,
    marginLeft: 8, // Changed from marginRight to marginLeft for placement after time
  },
  extraClassTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ExtraClassTag;
