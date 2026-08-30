import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { BaseModal } from '@/components/BaseModal';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface CustomPickerProps<T> {
  label: string;
  selectedValue: T;
  onValueChange: (value: T) => void;
  options: { label: string; value: T }[];
  modalTitle: string;
  /** When provided, the picker modal is controlled by the parent. */
  isVisible?: boolean;
  onClose?: () => void;
}

export const CustomPicker = <T extends string | number>({
  label,
  selectedValue,
  onValueChange,
  options,
  modalTitle,
  isVisible,
  onClose,
}: CustomPickerProps<T>) => {
  const colorScheme = useColorScheme() ?? 'light';
  const [modalVisible, setModalVisible] = useState(false);

  const selectedLabel = useMemo(() => {
    const selectedOption = options.find((option) => option.value === selectedValue);
    return selectedOption ? selectedOption.label : '';
  }, [selectedValue, options]);
  const modalIsVisible = isVisible ?? modalVisible;
  const closeModal = () => {
    setModalVisible(false);
    onClose?.();
  };

  return (
    <View style={styles.inputGroup}>
      {label !== '' && <ThemedText style={[styles.label, { color: Colors[colorScheme].text }]}>{label}</ThemedText>}
      <TouchableOpacity
        style={[
          styles.pickerButton,
          {
            backgroundColor: Colors[colorScheme].card,
            borderColor: Colors[colorScheme].border,
          },
        ]}
        onPress={() => setModalVisible(true)}
      >
        <ThemedText style={{ color: Colors[colorScheme].text, fontSize: 14 }}>
          {selectedLabel}
        </ThemedText>
        <Ionicons name="chevron-down" size={20} color={Colors[colorScheme].icon} />
      </TouchableOpacity>

      <BaseModal
        isVisible={modalIsVisible}
        onClose={closeModal}
        title={modalTitle}
        showCloseButton={true}
        dismissOnBackdropPress={true}
      >
        <FlatList
          data={options}
          keyExtractor={(item) => item.value.toString()}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          renderItem={({ item }) => {
            const isSelected = item.value === selectedValue;
            return (
              <TouchableOpacity
                style={[
                  styles.optionItem,
                  { borderBottomColor: Colors[colorScheme].separator },
                ]}
                onPress={() => {
                  onValueChange(item.value);
                  closeModal();
                }}
              >
                <ThemedText
                  style={[
                    styles.optionText,
                    { color: isSelected ? Colors[colorScheme].tint : Colors[colorScheme].text },
                    isSelected && styles.selectedOptionText,
                  ]}
                >
                  {item.label}
                </ThemedText>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors[colorScheme].tint} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </BaseModal>
    </View>
  );
};

const styles = StyleSheet.create({
  inputGroup: {},
  label: {
    fontSize: 15,
    marginBottom: 8,
    fontWeight: '500',
  },
  pickerButton: {
    height: 48,
    paddingHorizontal: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  list: {
    maxHeight: 320,
  },
  optionItem: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: 14,
  },
  selectedOptionText: {
    fontWeight: '600',
  },
});
