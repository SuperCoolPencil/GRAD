import 'react-native-get-random-values';
import '@/utils/productionLogging';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useContext } from 'react';
import { Linking, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import 'react-native-reanimated';
import { AppProvider, AppContext } from '../context/AppContext';
import { AlertProvider } from '../context/AlertContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '../constants/Colors';
import {
  setupNotificationChannels,
  requestPermissions,
  handleNotificationAttendanceAction,
  scheduleUpdateNotification,
  cancelUpdateNotification,
  scheduleBackupReminder,
  cancelBackupReminder,
} from '@/utils/notifications';

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
  const { triggerRefresh, loading, updateNotificationsEnabled, settings } = useContext(AppContext);
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
    if (!loaded || loading) return;

    let isActive = true;
    const syncUpdateNotification = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/SuperCoolPencil/GRAD/releases/latest');
        if (!response.ok) throw new Error(`Update check failed: ${response.status}`);

        const data = await response.json();
        const latestVersion = typeof data.tag_name === 'string' ? data.tag_name : '';
        if (!isActive) return;

        const currentVersion = `v${Constants.expoConfig?.version}`;
        if (updateNotificationsEnabled && latestVersion && latestVersion !== currentVersion) {
          await scheduleUpdateNotification(latestVersion);
        } else {
          await cancelUpdateNotification();
        }
      } catch (error) {
        console.error('Failed to check for app updates:', error);
      }
    };

    syncUpdateNotification();
    return () => { isActive = false; };
  }, [loaded, loading, updateNotificationsEnabled]);

  useEffect(() => {
    if (!loaded || loading) return;

    if (settings.backupRemindersEnabled === 'true') {
      scheduleBackupReminder();
    } else {
      cancelBackupReminder();
    }
  }, [loaded, loading, settings.backupRemindersEnabled]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log('[NOTIF_RESPONSE] Listener fired. Response:', JSON.stringify(response, null, 2));
      const { courseId, scheduleId, occurrenceDate, url } = response.notification.request.content.data as {
        courseId?: string;
        scheduleId?: string;
        occurrenceDate?: string;
        url?: string;
      };
      const actionIdentifier = response.actionIdentifier;
      console.log(`[NOTIF_RESPONSE] Action: ${actionIdentifier}, Course: ${courseId}, Schedule: ${scheduleId}`);

      if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && typeof url === 'string') {
        try {
          await Linking.openURL(url);
        } catch (error) {
          console.error('Failed to open notification link:', error);
        }
        return;
      }

      if (actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER && courseId && scheduleId) {
        // Call the utility function to handle the attendance action
        await handleNotificationAttendanceAction(
          courseId,
          scheduleId,
          actionIdentifier as 'present' | 'absent' | 'cancelled',
          response.notification.request.identifier,
          occurrenceDate,
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
