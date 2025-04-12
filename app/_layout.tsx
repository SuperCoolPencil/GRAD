import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { AppProvider } from '../context/AppContext';
import { AlertProvider } from '../context/AlertContext';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '../constants/Colors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  return (
    <AppProvider>
      <AlertProvider>
        <ThemeProvider value={useColorScheme() === 'dark' ? DarkTheme : DefaultTheme}>
          <RootLayoutShell loaded={loaded}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </RootLayoutShell>
        </ThemeProvider>
      </AlertProvider>
    </AppProvider>
  );
}

function RootLayoutShell({ children, loaded }: { children: React.ReactNode; loaded: boolean }) {
  const colorScheme = useColorScheme();

  if (!loaded) {
    return null;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors[colorScheme ?? 'light'].background,
      }}
    >
      <StatusBar style="auto" />
      {children}
    </View>
  );
}
