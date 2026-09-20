/**
 * The four tabs.
 *
 * `expo-router/unstable-native-tabs` would give the iOS 26 Liquid Glass bar,
 * but it is still marked unstable in SDK 57, so the JS tabs are used instead
 * (see docs/KARARLAR.md).
 *
 * Each screen draws its own hero header, so the native one is turned off here.
 */
import { Tabs } from 'expo-router/js-tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { View } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Icon plus the short accent bar that marks the active tab. */
function TabIcon({
  name,
  focused,
  activeColor,
  inactiveColor,
}: {
  name: SFSymbol;
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 5 }}>
      <SymbolView
        name={name}
        size={24}
        tintColor={focused ? activeColor : inactiveColor}
        resizeMode="scaleAspectFit"
        style={{ width: 24, height: 24 }}
      />
      <View
        style={{
          height: 3,
          width: focused ? 22 : 0,
          borderRadius: 2,
          backgroundColor: activeColor,
        }}
      />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  const tabIcon = (idle: SFSymbol, active: SFSymbol) => {
    function TabBarIcon({ focused }: { focused: boolean }) {
      return (
        <TabIcon
          name={focused ? active : idle}
          focused={focused}
          activeColor={colors.accent}
          inactiveColor={colors.textTertiary}
        />
      );
    }
    return TabBarIcon;
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        // The quick-add row sits above this bar; hiding it on keyboard keeps
        // the input reachable instead of stacked behind the keyboard.
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.separator,
          paddingTop: space.sm,
        },
        sceneStyle: { backgroundColor: colors.groupedBackground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bugün',
          tabBarLabel: 'Bugün',
          tabBarIcon: tabIcon('sun.max', 'sun.max.fill'),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Liste',
          tabBarLabel: 'Liste',
          tabBarIcon: tabIcon('list.bullet', 'list.bullet.rectangle.fill'),
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: 'Yerler',
          tabBarLabel: 'Yerler',
          tabBarIcon: tabIcon('mappin.and.ellipse', 'mappin.circle.fill'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarLabel: 'Ayarlar',
          tabBarIcon: tabIcon('slider.horizontal.3', 'gearshape.fill'),
        }}
      />
    </Tabs>
  );
}
