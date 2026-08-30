import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Pressable, useColorScheme } from 'react-native';
import { format } from 'date-fns';
import { ThemedText } from './ThemedText';
import { BaseModal } from './BaseModal';
import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { parseISOToDate } from '@/utils/dateHelpers';

interface NameDayEventModalProps {
  isVisible: boolean;
  dayEvent: { date: string; type: 'holiday' | 'skip' } | null;
  onClose: () => void;
  onSave: (eventName: string, type: 'holiday' | 'skip', date: string) => void;
}

export function NameDayEventModal({
  isVisible,
  dayEvent,
  onClose,
  onSave,
}: NameDayEventModalProps) {
  const [eventName, setEventName] = useState('');
  const colorScheme = useColorScheme() ?? 'light';
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const borderColor = Colors[colorScheme].separator;
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (isVisible) {
      setEventName('');
    }
  }, [isVisible]);

  if (!dayEvent) return null;

  const isSkip = dayEvent.type === 'skip';
  const titleText = `Name this ${isSkip ? 'skip day' : 'holiday'}`;
  const formattedSubtitle = dayEvent.date
    ? format(parseISOToDate(dayEvent.date), 'EEEE, MMMM d, yyyy')
    : '';

  const handleSave = () => {
    const trimmed = eventName.trim();
    if (trimmed && dayEvent) {
      onSave(trimmed, dayEvent.type, dayEvent.date);
      onClose();
    }
  };

  const isButtonDisabled = !eventName.trim();

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
          {
            backgroundColor: tintColor,
            opacity: isButtonDisabled ? 0.5 : pressed ? 0.75 : 1,
          },
        ]}
        disabled={isButtonDisabled}
        onPress={handleSave}
      >
        <ThemedText style={[styles.buttonText, { color: '#fff', fontWeight: 'bold' }]}>
          Add {isSkip ? 'Skip Day' : 'Holiday'}
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title={titleText}
      subtitle={formattedSubtitle}
      showCloseButton={true}
      dismissOnBackdropPress={true}
      footer={footerContent}
    >
      <View style={styles.container}>
        <TextInput
          autoFocus
          value={eventName}
          onChangeText={setEventName}
          placeholder={isSkip ? 'e.g. Study leave' : 'e.g. Gandhi Jayanti'}
          placeholderTextColor={textSecondaryColor}
          style={[
            styles.eventNameInput,
            {
              color: textColor,
              borderColor: borderColor,
              backgroundColor: Colors[colorScheme].inputBackground,
            },
          ]}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  eventNameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
