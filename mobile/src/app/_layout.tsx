import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ModelProvider } from '../hooks/ModelProvider';
import { SettingsProvider, useSettings } from '../hooks/SettingsProvider';
import { useTheme } from '../theme';

export { ErrorBoundary } from '../components/ErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { colors, dark } = useTheme();
  const { loaded } = useSettings();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="analyze" options={{ title: 'Checking leaf', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="scan/[id]" options={{ title: 'Result' }} />
        <Stack.Screen name="disease/[id]" options={{ title: 'Disease guide' }} />
        <Stack.Screen name="tips" options={{ title: 'Photo tips', presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ModelProvider>
          <RootStack />
        </ModelProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
