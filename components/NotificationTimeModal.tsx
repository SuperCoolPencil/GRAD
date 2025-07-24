import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

interface NotificationTimeModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (time: number) => void;
  initialTime: number;
}

const NotificationTimeModal: React.FC<NotificationTimeModalProps> = ({
  isVisible,
  onClose,
  onSave,
  initialTime,
}) => {
  const [inputValue, setInputValue] = useState(String(initialTime));
  const colorScheme = useColorScheme() ?? 'light';
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const primaryColor = useThemeColor({}, 'alertPrimary');
  const tintColor = useThemeColor({}, 'tint');

  const handleSave = () => {
    const newValue = parseInt(inputValue, 10);
    if (!isNaN(newValue) && newValue >= 0) {
      onSave(newValue);
      onClose();
    } else {
      // You might want to show an alert here
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <ThemedView style={[styles.modalView, { borderColor }]} lightColor={Colors.light.alert} darkColor={Colors.dark.alert}>
          <ThemedText type="subtitle" style={styles.modalTitle}>
            Set Notification Time
          </ThemedText>
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
            placeholder="Enter new time"
            placeholderTextColor={textColor}
          />
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.basicButton,
                {
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: tintColor,
                  opacity: pressed ? 0.7 : 1,
                  marginLeft: 0,
                  elevation: 0,
                },
              ]}
              onPress={onClose}
            >
              <ThemedText style={[styles.buttonText, { color: tintColor }]}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.basicButton,
                {
                  backgroundColor: primaryColor,
                  opacity: pressed ? 0.7 : 1,
                  marginLeft: 10,
                  elevation: 2,
                },
              ]}
              onPress={handleSave}
            >
              <ThemedText style={[styles.buttonText, { color: '#fff' }]}>Save</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalView: {
    width: '85%',
    maxWidth: 450,
    margin: 20,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalTextInput: {
    height: 45,
    borderWidth: 1,
    paddingHorizontal: 15,
    borderRadius: 8,
    width: '80%',
    marginBottom: 0,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20,
  },
  basicButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default NotificationTimeModal;
