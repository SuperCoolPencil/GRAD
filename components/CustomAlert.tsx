import React from 'react';
import { StyleSheet, View, Pressable, Modal, Platform } from 'react-native'; // Import Modal from react-native
import { ThemedText } from './ThemedText';
import { BlurView } from 'expo-blur';
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
  const primaryColor = useThemeColor({}, 'alertPrimary'); // For primary button
  const destructiveColor = useThemeColor({}, 'alertDestructive'); // For destructive button
  const tintColor = useThemeColor({}, 'tint'); // For destructive button

  const isColumnLayout = alertButtons.length > 2;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <BlurView intensity={25} style={styles.blurView} tint="dark">
        <View style={styles.centeredView}>
          <ThemedView
            style={[styles.modalView, { borderColor }]}
            lightColor={Colors.light.alert}
            darkColor={Colors.dark.alert}
          >
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
            <View style={[styles.buttonContainer, isColumnLayout && styles.buttonColumn]}>
              {alertButtons.map((button, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.button,
                    isColumnLayout && styles.buttonFullWidth,
                    {
                      backgroundColor:
                        button.style === 'destructive'
                          ? destructiveColor
                          : button.style === 'cancel'
                          ? 'transparent'
                          : primaryColor,
                      opacity: pressed ? 0.7 : 1,
                      borderWidth: button.style === 'cancel' ? 1 : 0,
                      borderColor:
                        button.style === 'cancel' ? tintColor : 'transparent',
                      elevation: button.style === 'cancel' ? 0 : 2,
                    },
                  ]}
                  onPress={() => {
                    if (button.onPress) {
                      button.onPress();
                    }
                    onClose();
                  }}
                >
                  <ThemedText
                    style={[
                      styles.buttonText,
                      {
                        color:
                          button.style === 'destructive'
                            ? '#fff'
                            : button.style === 'cancel'
                            ? tintColor
                            : '#fff',
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
        </View>
      </BlurView>
    </Modal>
  );
}

// Styles adapted from the example and previous basic version
const styles = StyleSheet.create({
  blurView: {
    flex: 1,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent backdrop
  },
  modalView: {
    width: '85%',
    maxWidth: 450,
    margin: 20,
    borderRadius: 12, // Keep previous border radius
    padding: 20, // Keep previous padding
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  titleText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  buttonColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 5,
  },
  buttonFullWidth: {
    width: '100%',
    marginHorizontal: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold', // Match example text style
    textAlign: 'center',
  },
});
