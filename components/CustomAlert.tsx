import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Modal from 'react-native-modal';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { AlertButton } from '@/types'; // Assuming AlertButton type is defined here

interface CustomAlertProps {
  isVisible: boolean;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  onClose: () => void; // Function to close the modal from the context
}

export function CustomAlert({
  isVisible,
  title,
  message,
  buttons,
  onClose,
}: CustomAlertProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const primaryColor = useThemeColor({}, 'tint'); // For primary button

  const defaultButtons: AlertButton[] = [{ text: 'OK', onPress: onClose }];
  const alertButtons = buttons && buttons.length > 0 ? buttons : defaultButtons;

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose} // Close on backdrop press
      onBackButtonPress={onClose} // Close on hardware back button press (Android)
      animationIn="fadeInUp"
      animationOut="fadeOutDown"
      backdropTransitionOutTiming={0}
      style={styles.modal}
    >
      <ThemedView style={[styles.container, { borderColor }]} lightColor="#fff" darkColor="#1f1e1e">
        {title && (
          <ThemedText type="subtitle" style={styles.title}>
            {title}
          </ThemedText>
        )}
        {message && (
          <ThemedText style={[styles.message, { color: textColor }]}>
            {message}
          </ThemedText>
        )}
        <View style={styles.buttonContainer}>
          {alertButtons.map((button, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: button.style === 'cancel' || button.style === 'destructive' ? 'transparent' : primaryColor,
                  opacity: pressed ? 0.7 : 1,
                  marginLeft: index > 0 ? 10 : 0, // Add margin between buttons
                },
              ]}
              onPress={() => {
                onClose(); // Close the modal first
                if (button.onPress) {
                  button.onPress(); // Then execute the button's action
                }
              }}
            >
              <ThemedText
                style={[
                  styles.buttonText,
                  {
                    color: button.style === 'cancel' || button.style === 'destructive' ? (button.style === 'destructive' ? 'red' : primaryColor) : '#fff',
                    fontWeight: button.style === 'cancel' ? 'normal' : 'bold',
                  },
                ]}
              >
                {button.text}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0, // Use margin for positioning container if needed
  },
  container: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  message: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center', // Center buttons if only one, space if multiple? Adjust as needed.
    marginTop: 10,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80, // Ensure buttons have a minimum width
  },
  buttonText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
