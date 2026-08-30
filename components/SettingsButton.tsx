import React from 'react';
import { TouchableOpacity, StyleSheet, View, useColorScheme } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';

export type SettingsButtonProps = {
  onPress?: () => void;
  title: string;
  subtitle?: string;
  value?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  backgroundColor?: string;
  textColor?: string;
  isInformational?: boolean;
  isDestructive?: boolean;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
};

export default function SettingsButton({
  onPress,
  title,
  subtitle,
  value,
  iconName,
  iconColor,
  backgroundColor,
  textColor,
  isInformational = false,
  isDestructive = false,
  showChevron = !isInformational && !!onPress,
  rightElement,
}: SettingsButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';

  const defaultTextColor = isDestructive
    ? Colors[colorScheme].error
    : Colors[colorScheme].text;

  const defaultIconColor = isDestructive
    ? Colors[colorScheme].error
    : iconColor || Colors[colorScheme].tint;

  const finalTextColor = textColor || defaultTextColor;
  const finalIconColor = defaultIconColor;

  const content = (
    <View
      style={[
        styles.container,
        backgroundColor ? { backgroundColor } : null,
        isInformational && styles.informational,
      ]}
    >
      <View style={styles.leftContent}>
        {iconName ? (
          <View style={[styles.iconContainer, { backgroundColor: isDestructive ? 'rgba(251, 30, 8, 0.1)' : 'rgba(0, 150, 255, 0.1)' }]}>
            <Ionicons name={iconName} size={18} color={finalIconColor} />
          </View>
        ) : null}
        <View style={styles.textContainer}>
          <ThemedText style={[styles.title, { color: finalTextColor }]}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].textSecondary }]}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.rightContent}>
        {value ? (
          <ThemedText style={[styles.valueText, { color: Colors[colorScheme].textSecondary }]}>
            {value}
          </ThemedText>
        ) : null}
        {rightElement}
        {showChevron && !rightElement ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors[colorScheme].icon}
            style={styles.chevron}
          />
        ) : null}
      </View>
    </View>
  );

  if (isInformational || !onPress) {
    return content;
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  informational: {
    opacity: 0.85,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
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
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 14,
    marginRight: 4,
  },
  chevron: {
    marginLeft: 4,
  },
});
