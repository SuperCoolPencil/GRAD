import React from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  useColorScheme,
  StyleProp,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';

export interface BaseModalProps {
  isVisible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  showCloseButton?: boolean;
  dismissOnBackdropPress?: boolean;
  maxWidth?: number;
  animationType?: 'fade' | 'slide' | 'none';
  children?: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function BaseModal({
  isVisible,
  onClose,
  title,
  subtitle,
  showCloseButton = false,
  dismissOnBackdropPress = true,
  maxWidth = 420,
  animationType = 'fade',
  children,
  footer,
  style,
  contentStyle,
}: BaseModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const iconColor = useThemeColor({}, 'icon');
  const modalBorderColor = Colors[colorScheme].separator;

  return (
    <Modal
      animationType={animationType}
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.centeredView}>
          {/* Backdrop Blur + Dim Overlay */}
          <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
          <Pressable
            style={[StyleSheet.absoluteFill, styles.backdropOverlay]}
            onPress={dismissOnBackdropPress ? onClose : undefined}
          />

          {/* Modal Content Card */}
          <View
            style={[
              styles.modalView,
              {
                maxWidth,
                backgroundColor: Colors[colorScheme].alert,
                borderColor: modalBorderColor,
              },
              style,
            ]}
          >
            {/* Optional Header */}
            {(title || subtitle || showCloseButton) && (
              <View style={styles.headerContainer}>
                <View style={styles.headerTitleArea}>
                  {title && (
                    <ThemedText type="subtitle" style={styles.titleText}>
                      {title}
                    </ThemedText>
                  )}
                  {subtitle && (
                    <ThemedText style={[styles.subtitleText, { color: textSecondaryColor }]}>
                      {subtitle}
                    </ThemedText>
                  )}
                </View>
                {showCloseButton && (
                  <Pressable
                    onPress={onClose}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.closeIconButton,
                      pressed && styles.closeIconButtonPressed,
                    ]}
                  >
                    <Ionicons name="close" size={20} color={iconColor} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Body */}
            {children && <View style={[styles.contentContainer, contentStyle]}>{children}</View>}

            {/* Footer */}
            {footer && <View style={styles.footerContainer}>{footer}</View>}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalView: {
    width: '90%',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleArea: {
    flex: 1,
    paddingRight: 8,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  closeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
  },
  closeIconButtonPressed: {
    opacity: 0.7,
  },
  contentContainer: {
    width: '100%',
  },
  footerContainer: {
    width: '100%',
    marginTop: 20,
  },
});
