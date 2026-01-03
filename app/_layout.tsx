import 'react-native-get-random-values';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useContext } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import 'react-native-reanimated';
import { AppProvider, AppContext } from '../context/AppContext';
import { AlertProvider } from '../context/AlertContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { formatDateToISO } from '@/utils/dateHelpers';
import { Colors } from '../constants/Colors';
import { setupNotificationChannels, requestPermissions, handleNotificationAttendanceAction } from '@/utils/notifications';
import * as db from '../utils/database';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AlertProvider>
          <RootLayoutShell />
        </AlertProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutShell() {
  const colorScheme = useColorScheme();
  const { triggerRefresh } = useContext(AppContext);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });


  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      setupNotificationChannels();
      requestPermissions();
    }
  }, [loaded]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { courseId, scheduleId } = response.notification.request.content.data as { courseId: string, scheduleId: string };
      const actionIdentifier = response.actionIdentifier;

      if (actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // Call the utility function to handle the attendance action
        await handleNotificationAttendanceAction(
          courseId,
          scheduleId,
          actionIdentifier as 'present' | 'absent' | 'cancelled',
          response.notification.request.identifier
        );
        // Refresh the app data to reflect the change immediately
        triggerRefresh();
      }
    });

    return () => subscription.remove();
  }, [triggerRefresh]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View
        style={{
          flex: 1,
          backgroundColor: Colors[colorScheme ?? 'light'].background,
        }}
      >
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-extra-class" options={{ headerShown: false }} />
          <Stack.Screen name="add-course" options={{ headerShown: false }} />
          <Stack.Screen name="archived-courses" options={{ headerShown: false }} />
          <Stack.Screen name="course/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="edit-course/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="manage-holidays" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </View>
    </ThemeProvider>
  );
}
