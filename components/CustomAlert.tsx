import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { BaseModal } from './BaseModal';
import { useThemeColor } from '@/hooks/useThemeColor';
import { AlertButton } from '@/types';

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

  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'alertPrimary');
  const destructiveColor = useThemeColor({}, 'alertDestructive');
  const tintColor = useThemeColor({}, 'tint');

  const isColumnLayout = alertButtons.length > 2;

  const footerContent = (
    <View style={[styles.buttonContainer, isColumnLayout && styles.buttonColumn]}>
      {alertButtons.map((button, index) => {
        const isDestructive = button.style === 'destructive';
        const isCancel = button.style === 'cancel';
        const bgColor = isDestructive
          ? destructiveColor
          : isCancel
          ? 'transparent'
          : primaryColor;
        const buttonTextColor = isDestructive
          ? '#fff'
          : isCancel
          ? tintColor
          : '#fff';

        return (
          <Pressable
            key={index}
            style={({ pressed }) => [
              styles.button,
              isColumnLayout && styles.buttonFullWidth,
              {
                backgroundColor: bgColor,
                opacity: pressed ? 0.75 : 1,
                borderWidth: isCancel ? 1 : 0,
                borderColor: isCancel ? tintColor : 'transparent',
              },
            ]}
            onPress={() => {
              if (button.onPress) {
                button.onPress();
              }
              if (button.shouldCloseAlert !== false) {
                onClose();
              }
            }}
          >
            <ThemedText
              style={[
                styles.buttonText,
                {
                  color: buttonTextColor,
                  fontWeight: isCancel ? '600' : '700',
                },
              ]}
            >
              {button.text}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title={title}
      dismissOnBackdropPress={true}
      footer={footerContent}
    >
      {message && (
        <ThemedText style={[styles.messageText, { color: textColor }]}>
          {message}
        </ThemedText>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  buttonColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 100,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFullWidth: {
    width: '100%',
    flex: 0,
  },
  buttonText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
