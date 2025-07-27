import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import { useTheme } from '@react-navigation/native';

type SettingsButtonProps = {
  onPress: () => void;
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  textColor?: string;
};

export default function SettingsButton({ onPress, title, iconName, backgroundColor, textColor = '#fff' }: SettingsButtonProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor }]}
      onPress={onPress}
    >
      <View style={styles.buttonContent}>
        <Ionicons name={iconName} size={20} color={textColor} style={styles.icon} />
        <ThemedText style={[styles.buttonText, { color: textColor }]}>{title}</ThemedText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'flex-start',
    marginTop: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
