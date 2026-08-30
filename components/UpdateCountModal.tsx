import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Pressable, useColorScheme } from 'react-native';
import { ThemedText } from './ThemedText';
import { BaseModal } from './BaseModal';
import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';

interface UpdateCountModalProps {
  isVisible: boolean;
  countType: 'presents' | 'absents' | 'cancelled';
  initialValue: number;
  onClose: () => void;
  onSave: (newValue: number) => void;
}

export function UpdateCountModal({
  isVisible,
  countType,
  initialValue,
  onClose,
  onSave,
}: UpdateCountModalProps) {
  const [inputValue, setInputValue] = useState(String(initialValue));
  const colorScheme = useColorScheme() ?? 'light';
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const borderColor = Colors[colorScheme].separator;
  const primaryColor = useThemeColor({}, 'alertPrimary');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    setInputValue(String(initialValue));
  }, [initialValue, isVisible]);

  const handleSave = () => {
    const newValue = parseInt(inputValue, 10);
    if (!isNaN(newValue) && newValue >= 0) {
      onSave(newValue);
      onClose();
    }
  };

  const titleText = `Update ${countType.charAt(0).toUpperCase() + countType.slice(1)} Count`;

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
          Submit
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title={titleText}
      showCloseButton={true}
      dismissOnBackdropPress={true}
      footer={footerContent}
    >
      <View style={styles.container}>
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
          placeholder="Enter count"
          placeholderTextColor={textSecondaryColor}
          selectTextOnFocus
          autoFocus
        />
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalTextInput: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: '100%',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
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
