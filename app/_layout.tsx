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
import { Colors } from '../constants/Colors';

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
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { courses, addAttendance } = useContext(AppContext);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { courseId, scheduleId } = response.notification.request.content.data as { courseId: string, scheduleId: string };
      const actionIdentifier = response.actionIdentifier;

      if (actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        const course = courses.find(c => c.id === courseId);
        const isExtraClass = course?.extraClasses?.some(ec => ec.id === scheduleId) || false;
        addAttendance(courseId, scheduleId, actionIdentifier as 'present' | 'absent' | 'cancelled', isExtraClass);
      }
    });

    return () => subscription.remove();
  }, [addAttendance, courses]);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <AlertProvider>
          <ThemeProvider value={useColorScheme() === 'dark' ? DarkTheme : DefaultTheme}>
            <RootLayoutShell loaded={loaded}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="add-extra-class" options={{ headerShown: false }} />
                <Stack.Screen name="add-course" options={{ headerShown: false }} />
                <Stack.Screen name="archived-courses" options={{ headerShown: false }} />
                <Stack.Screen name="course/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="edit-course/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
            </RootLayoutShell>
          </ThemeProvider>
        </AlertProvider>
      </AppProvider>
    </SafeAreaProvider>
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
