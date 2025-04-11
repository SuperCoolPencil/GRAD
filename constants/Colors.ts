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
    success: '#00FF00',
    error: '#FF0000',
    warning: '#FFA500',
    shadow: '#000000',
  },
  dark: {
    text: '#ECEDEE',
    background: '#010101',
    tint: '#007AFF',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    foreground: '#101010',
    success: '#4caf50',
    error: '#c93d33',
    warning: '#FFA500',
    shadow: '#000000',
  },
};
