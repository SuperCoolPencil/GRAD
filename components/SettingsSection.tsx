import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';

interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

export default function SettingsSection({ title, children }: SettingsSectionProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const childrenArray = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.sectionContainer}>
      {title ? (
        <ThemedText style={[styles.sectionTitle, { color: Colors[colorScheme].textSecondary }]}>
          {title}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.cardContainer,
          {
            backgroundColor: Colors[colorScheme].card,
          },
        ]}
      >
        {childrenArray.map((child, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <View
                style={[
                  styles.separator,
                  { backgroundColor: Colors[colorScheme].separator },
                ]}
              />
            )}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 12,
  },
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    marginHorizontal: 0,
  },
});
