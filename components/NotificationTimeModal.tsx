import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Pressable, useColorScheme } from 'react-native';
import { ThemedText } from './ThemedText';
import { BaseModal } from './BaseModal';
import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { NotificationTiming, NotificationAnchor } from '@/types';

interface NotificationTimeModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (timing: NotificationTiming) => void;
  initialTiming: NotificationTiming;
}

const ANCHOR_OPTIONS: { label: string; value: NotificationAnchor }[] = [
  { label: 'Before Start', value: 'before_start' },
  { label: 'After Start', value: 'after_start' },
  { label: 'After End', value: 'after_end' },
];

export function NotificationTimeModal({
  isVisible,
  onClose,
  onSave,
  initialTiming,
}: NotificationTimeModalProps) {
  const [inputValue, setInputValue] = useState(String(initialTiming.value));
  const [anchor, setAnchor] = useState<NotificationAnchor>(initialTiming.anchor);
  const colorScheme = useColorScheme() ?? 'light';
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const borderColor = Colors[colorScheme].separator;
  const primaryColor = useThemeColor({}, 'alertPrimary');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    setInputValue(String(initialTiming.value));
    setAnchor(initialTiming.anchor);
  }, [initialTiming]);

  const handleSave = () => {
    const newValue = parseInt(inputValue, 10);
    if (!isNaN(newValue) && newValue >= 0) {
      onSave({ value: newValue, anchor });
      onClose();
    }
  };

  const footerContent = (
    <View style={styles.buttonRow}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.cancelButton,
          { borderColor: tintColor, opacity: pressed ? 0.75 : 1 },
        ]}
        onPress={onClose}
      >
        <ThemedText style={[styles.buttonText, { color: tintColor }]}>
          Cancel
        </ThemedText>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: primaryColor, opacity: pressed ? 0.75 : 1 },
        ]}
        onPress={handleSave}
      >
        <ThemedText style={[styles.buttonText, { color: '#fff', fontWeight: 'bold' }]}>
          Save
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title="Set Notification Time"
      showCloseButton={true}
      dismissOnBackdropPress={true}
      footer={footerContent}
    >
      <View style={styles.container}>
        {/* Anchor Segment Selector */}
        <ThemedText style={[styles.sectionLabel, { color: textSecondaryColor }]}>
          Trigger Anchor
        </ThemedText>
        <View style={styles.anchorContainer}>
          {ANCHOR_OPTIONS.map((option) => {
            const isSelected = anchor === option.value;
            return (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.anchorButton,
                  isSelected
                    ? { backgroundColor: tintColor, borderColor: tintColor }
                    : { borderColor: borderColor, backgroundColor: 'transparent' },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setAnchor(option.value)}
              >
                <ThemedText
                  style={[
                    styles.anchorButtonText,
                    isSelected ? { color: '#fff', fontWeight: '600' } : { color: textColor },
                  ]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Time Input */}
        <ThemedText style={[styles.sectionLabel, { color: textSecondaryColor, marginTop: 12 }]}>
          Timing Offset
        </ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.modalTextInput,
              {
                color: textColor,
                borderColor: borderColor,
                backgroundColor: Colors[colorScheme].inputBackground,
              },
            ]}
            keyboardType="number-pad"
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Minutes"
            placeholderTextColor={textSecondaryColor}
            selectTextOnFocus
          />
          <ThemedText style={styles.minutesLabel}>minutes</ThemedText>
        </View>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  anchorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  anchorButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorButtonText: {
    fontSize: 13,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTextInput: {
    height: 46,
    borderWidth: 1,
    paddingHorizontal: 16,
    borderRadius: 10,
    width: 100,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  minutesLabel: {
    marginLeft: 12,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotificationTimeModal;
