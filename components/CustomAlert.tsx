import React from 'react';
import { StyleSheet, View, Pressable, Modal } from 'react-native'; // Import Modal from react-native
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { AlertButton } from '@/types';
import { Colors } from '@/constants/Colors';

interface CustomAlertProps {
  isVisible: boolean;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  onClose: () => void;
}

export function CustomAlert({
  isVisible,
  title,
  message,
  buttons,
  onClose,
}: CustomAlertProps) {

  const defaultButtons: AlertButton[] = [{ text: 'OK', onPress: onClose }];
  const alertButtons = buttons && buttons.length > 0 ? buttons : defaultButtons;

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const primaryColor = useThemeColor({}, 'tint'); // For primary button
  const errorColor = useThemeColor({}, 'error'); // For destructive button

  return (
    <Modal
      animationType="fade" // Using fade animation like react-native-modal's fadeOut
      transparent={true} // Required for overlay effect
      visible={isVisible}
      onRequestClose={onClose} // Handle hardware back button press
    >
      {/* Centering container similar to the example */}
      <View style={styles.centeredView}>
        {/* Modal content view with styling from the example */}
        <ThemedView style={[styles.modalView, { borderColor }]} lightColor={Colors.light.alert} darkColor={Colors.dark.alert}>
          {title && (
            <ThemedText type="subtitle" style={styles.titleText}>
              {title}
            </ThemedText>
          )}
          {message && (
            <ThemedText style={[styles.messageText, { color: textColor }]}>
              {message}
            </ThemedText>
          )}
          <View style={styles.buttonRow}>
            {alertButtons.map((button, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.basicButton,
                  {
                    backgroundColor: button.style === 'destructive' ? errorColor : (button.style === 'cancel' ? 'transparent' : primaryColor),
                    opacity: pressed ? 0.7 : 1,
                    marginLeft: index > 0 ? 10 : 0, // Add margin between buttons
                    borderWidth: button.style === 'cancel' ? 1 : 0, // Add border to cancel button
                    borderColor: button.style === 'cancel' ? borderColor : 'transparent', // Use theme border color
                  },
                ]}
                onPress={() => {
                  if (button.onPress) {
                    button.onPress();
                  }
                  onClose(); // Close the modal
                }}
              >
                <ThemedText
                  style={[
                    styles.buttonText,
                    {
                      color: button.style === 'destructive' ? '#fff' : (button.style === 'cancel' ? textColor : '#fff'), // Use default text color for cancel
                      fontWeight: button.style === 'cancel' ? 'normal' : 'bold',
                      textAlign: 'center',
                    },
                  ]}
                >
                  {button.text}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

// Styles adapted from the example and previous basic version
const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent backdrop
  },
  modalView: {
    width: '85%',
    maxWidth: 400,
    margin: 20,
    borderRadius: 14, // Keep previous border radius
    padding: 20, // Keep previous padding
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: 10,
  },
  basicButton: {
    borderRadius: 8, // Keep previous border radius
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 80, // Keep previous min width
    elevation: 2, // Add slight elevation like example
    alignItems: 'center',
  },
  buttonMargin: {
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold', // Match example text style
    textAlign: 'center',
  },
});
