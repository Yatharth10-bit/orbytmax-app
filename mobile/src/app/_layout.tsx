import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { prefetchApi } from '@/lib/api';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  useEffect(() => {
    const catalogTimer = setTimeout(() => prefetchApi('/api/satellites?fast=1', 5 * 60_000, 24 * 60 * 60_000), 100);
    const trackerTimer = setTimeout(() => prefetchApi('/api/tracker/positions?limit=12', 30_000, 6 * 60 * 60_000), 500);
    return () => {
      clearTimeout(catalogTimer);
      clearTimeout(trackerTimer);
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.paper },
          headerStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '900' },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="satellite/[slug]" options={{ title: 'Mission detail' }} />
        <Stack.Screen name="quiz" options={{ title: 'Orbit basics quiz' }} />
      </Stack>
    </>
  );
}
