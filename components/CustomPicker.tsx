import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface CustomPickerProps<T> {
  label: string;
  selectedValue: T;
  onValueChange: (value: T) => void;
  options: { label: string; value: T }[];
  modalTitle: string;
}

export const CustomPicker = <T extends string | number>({ label, selectedValue, onValueChange, options, modalTitle }: CustomPickerProps<T>) => {
  const colorScheme = useColorScheme() ?? 'light';
  const [modalVisible, setModalVisible] = useState(false);

  const selectedLabel = useMemo(() => {
    const selectedOption = options.find(option => option.value === selectedValue);
    return selectedOption ? selectedOption.label : '';
  }, [selectedValue, options]);

  const styles = useMemo(() => StyleSheet.create({
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      marginBottom: 8,
      color: Colors[colorScheme].text,
      fontWeight: '500',
    },
    pickerButton: {
      backgroundColor: Colors[colorScheme].card,
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderColor: Colors[colorScheme].border,
      borderWidth: 1,
    },
    pickerButtonText: {
      color: Colors[colorScheme].text,
      fontSize: 16,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      backgroundColor: Colors[colorScheme].background,
      borderRadius: 10,
      padding: 20,
      width: '80%',
      maxHeight: '70%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 15,
      color: Colors[colorScheme].text,
    },
    optionItem: {
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: Colors[colorScheme].border,
    },
    optionText: {
      fontSize: 16,
      color: Colors[colorScheme].text,
    },
    selectedOptionText: {
      fontWeight: 'bold',
      color: Colors[colorScheme].tint,
    },
    closeButton: {
      marginTop: 20,
      backgroundColor: Colors[colorScheme].tint,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    closeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
  }), [colorScheme]);

  return (
    <View style={styles.inputGroup}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TouchableOpacity style={styles.pickerButton} onPress={() => setModalVisible(true)}>
        <ThemedText style={styles.pickerButtonText}>
          {selectedLabel}
        </ThemedText>
        <Ionicons name="chevron-down" size={20} color={Colors[colorScheme].text} />
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>{modalTitle}</ThemedText>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                >
                  <ThemedText style={[styles.optionText, item.value === selectedValue && styles.selectedOptionText]}>
                    {item.label}
                  </ThemedText>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <ThemedText style={styles.closeButtonText}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};
