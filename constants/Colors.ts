/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C', // Keeping text dark for contrast
    background: '#fff', // Already brightest
    tint: '#0096FF', // Brighter blue tint
    icon: '#687076', // Keeping icons standard gray
    tabIconDefault: '#687076',
    tabIconSelected: '#0096FF', // Match brighter tint
    foreground: '#F7F7F7', // Keeping foreground as is for now
    success: '#4caf50',
    error: '#c93d33',
    warning: '#FFA500',
    shadow: '#000000',
    placeholder: '#A0A0A0', 
    border: '#E0E0E0', // Lighter border color
    inputBackground: '#FFFFFF', // Already white
    buttonText: '#FFFFFF', 
    card: '#FFFFFF', // Making cards pure white for brighter feel
    disabledBackground: '#EEEEEE', // Lighter disabled background
    disabledText: '#BDBDBD', // Lighter disabled text
  },
  dark: {
    text: '#ECEDEE',
    background: '#17181c',
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
    disabledBackground: '#404040', // Background for disabled elements
    disabledText: '#808080', // Text color for disabled elements
  },
};
