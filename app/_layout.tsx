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
import { setupNotificationChannels, requestPermissions } from '@/utils/notifications';

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
  const { courses, upsertAttendance } = useContext(AppContext);
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
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { courseId, scheduleId } = response.notification.request.content.data as { courseId: string, scheduleId: string };
      const actionIdentifier = response.actionIdentifier;

      if (actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        const course = courses.find(c => c.id === courseId);
        if (course) {
          const isExtraClass = course.extraClasses?.some(ec => ec.id === scheduleId) || false;
          const scheduleItem = course.weeklySchedule?.find(s => s.id === scheduleId);
          const extraClassItem = course.extraClasses?.find(e => e.id === scheduleId);
          const timeStart = scheduleItem?.timeStart || extraClassItem?.timeStart || '';
          const timeEnd = scheduleItem?.timeEnd || extraClassItem?.timeEnd || '';
          const date = extraClassItem?.date || formatDateToISO(new Date());
          upsertAttendance(courseId, scheduleId, actionIdentifier as 'present' | 'absent' | 'cancelled', isExtraClass, timeStart, timeEnd, date);
          Notifications.dismissNotificationAsync(response.notification.request.identifier);
        }
      }
    });

    return () => subscription.remove();
  }, [upsertAttendance, courses]);

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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-extra-class" />
          <Stack.Screen name="add-course" />
          <Stack.Screen name="archived-courses" />
          <Stack.Screen name="course/[id]" />
          <Stack.Screen name="edit-course/[id]" />
          <Stack.Screen name="manage-holidays" />
          <Stack.Screen name="+not-found" options={{ headerShown: true }} />
        </Stack>
      </View>
    </ThemeProvider>
  );
}
