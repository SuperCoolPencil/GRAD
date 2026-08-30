import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';

type SettingsButtonProps = {
  onPress: () => void;
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  textColor?: string;
  isInformational?: boolean;
};

export default function SettingsButton({ onPress, title, iconName, backgroundColor, textColor = '#fff', isInformational = false }: SettingsButtonProps) {
  const content = (
    <View style={[styles.button, { backgroundColor }, isInformational && styles.informationalButton]}>
      <View style={styles.buttonContent}>
        <Ionicons name={iconName} size={20} color={textColor} style={styles.icon} />
        <ThemedText style={[styles.buttonText, { color: textColor }]}>{title}</ThemedText>
      </View>
    </View>
  );

  if (isInformational) return content;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'flex-start',
    marginTop: 8, 
    justifyContent: 'center', 
  },
  informationalButton: {
    opacity: 0.68,
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
