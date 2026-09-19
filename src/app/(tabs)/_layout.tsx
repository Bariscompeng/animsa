/**
 * The four tabs.
 *
 * `expo-router/unstable-native-tabs` would give the iOS 26 Liquid Glass bar,
 * but it is still marked unstable in SDK 57, so the JS tabs are used instead
 * (see docs/KARARLAR.md).
 */
import { Tabs } from 'expo-router/js-tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/theme/useTheme';

function TabIcon({ name, color }: { name: SFSymbol; color: ColorValue }) {
  return <SymbolView name={name} size={26} tintColor={color} style={{ width: 26, height: 26 }} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.accent,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        // The quick-add row sits above this bar; hiding it on keyboard keeps
        // the input reachable instead of stacked behind the keyboard.
        tabBarHideOnKeyboard: true,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.separator },
        sceneStyle: { backgroundColor: colors.groupedBackground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bugün',
          tabBarLabel: 'Bugün',
          tabBarIcon: ({ color }) => <TabIcon name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Liste',
          tabBarLabel: 'Liste',
          tabBarIcon: ({ color }) => <TabIcon name="cart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: 'Yerler',
          tabBarLabel: 'Yerler',
          tabBarIcon: ({ color }) => <TabIcon name="mappin.and.ellipse" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarLabel: 'Ayarlar',
          tabBarIcon: ({ color }) => <TabIcon name="gearshape" color={color} />,
        }}
      />
    </Tabs>
  );
}
