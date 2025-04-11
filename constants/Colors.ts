/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    foreground: '#F7F7F7',
    success: '#4caf50',
    error: '#c93d33',
    warning: '#FFA500',
    shadow: '#000000',
    placeholder: '#A0A0A0', // Example placeholder color
    border: '#CCCCCC', // Example border color
    inputBackground: '#FFFFFF', // Example input background color
    buttonText: '#FFFFFF', // Example button text color
    card: '#F7F7F7',
  },
  dark: {
    text: '#ECEDEE',
    background: '#010101',
    tint: '#8ec5ff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    foreground: '#101010',
    success: '#4caf50',
    error: '#c93d33',
    warning: '#FFA500',
    shadow: '#000000',
    placeholder: '#A0A0A0', // Example placeholder color
    border: '#666666', // Example border color
    inputBackground: '#333333', // Example input background color
    buttonText: '#FFFFFF', // Example button text color
    card: '#1A1A1A',
  },
};
