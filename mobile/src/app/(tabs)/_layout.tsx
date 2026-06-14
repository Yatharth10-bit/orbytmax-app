import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { colors } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: colors.yellow,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.ink, borderTopWidth: 2, height: 68 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '900' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: HomeIcon }} />
      <Tabs.Screen name="tracker" options={{ title: 'Live', tabBarIcon: LiveIcon }} />
      <Tabs.Screen name="tonight" options={{ title: 'Tonight', tabBarIcon: TonightIcon }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: LearnIcon }} />
    </Tabs>
  );
}

function TabSymbol({ color, symbol }: { color: string; symbol: string }) {
  return <Text style={{ color, fontSize: 20, fontWeight: '900' }}>{symbol}</Text>;
}

function HomeIcon({ color }: { color: string }) { return <TabSymbol color={color} symbol="✦" />; }
function LiveIcon({ color }: { color: string }) { return <TabSymbol color={color} symbol="●" />; }
function TonightIcon({ color }: { color: string }) { return <TabSymbol color={color} symbol="☾" />; }
function LearnIcon({ color }: { color: string }) { return <TabSymbol color={color} symbol="□" />; }
