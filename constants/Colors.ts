/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { white } from "react-native-paper/lib/typescript/styles/themes/v2/colors";

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    white: '#FFFFFF',
    text: '#11181C', // Keeping text dark for contrast
    background: '#f2f2f2', // Already brightest
    tint: '#0196FF', // Brighter blue tint
    icon: '#687076', // Keeping icons standard gray
    tabIconDefault: '#687076',
    tabIconSelected: '#0096FF', // Match brighter tint
    success: '#4caf50',
    error: '#fb1e08',
    warning: '#f8ba01',
    shadow: '#000000',
    placeholder: '#b2b2b6', 
    border: '#9C9C9C', // Lighter border color
    inputBackground: '#FFFFFF', // Already white
    buttonText: '#FFFFFF', 
    card: '#FFFFFF', // Making cards pure white for brighter feel
    alert: '#fff',
    alertPrimary: '#0196FF',
    alertDestructive: '#fb1e08',
  },
  dark: {
    white: '#FFFFFF',
    text: '#ECEDEE',
    background: '#010101', // background: '#010101',
    tint: '#0096FF',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    success: '#4caf50',
    error: '#c93d33',
    warning: '#FFA500',
    shadow: '#000000',
    placeholder: '#47474C', 
    border: '#666666', 
    inputBackground: '#1c1c1e',
    buttonText: '#FFFFFF',
    card: '#1c1c1e',
    alert:'#262626',
    alertPrimary: '#0096FF',
    alertDestructive: '#c93d33',
  },
};
