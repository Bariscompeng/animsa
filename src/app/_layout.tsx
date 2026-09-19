/**
 * Root layout: the migration gate, theme, notification wiring, deep links and
 * the foreground → sync trigger all live here.
 */
import { useEffect, useRef } from 'react';
import { AppState, Text, View, type AppStateStatus } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '@/../drizzle/migrations';
import { ToastProvider, useToast } from '@/components/Toast';
import { db } from '@/db/client';
import { logEvent } from '@/db/repos/misc';
import { getSetting } from '@/db/repos/settings';
import { completeOccurrence, getTask, snoozeOccurrence } from '@/db/repos/tasks';
import { seedIfNeeded } from '@/db/seed';
import { registerBackgroundSync } from '@/background/tasks';
import {
  ACTION_COMPLETE,
  ACTION_OPEN_ALTSTORE,
  ACTION_OPEN_LIST,
  ACTION_SNOOZE_10,
  addResponseListener,
  getLaunchResponse,
  installNotificationHandler,
  registerCategories,
  type NotificationPayload,
} from '@/services/notifications';
import { openAltStore } from '@/services/altstore';
import { handleUrl } from '@/services/deeplinks';
import { refreshRegions } from '@/services/location';
import { runAutoBackupIfDue } from '@/services/backup';
import * as signature from '@/services/signature';
import { sync } from '@/services/sync';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

void SplashScreen.preventAutoHideAsync();

installNotificationHandler();

function FatalError({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xl,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.danger, fontSize: 17, textAlign: 'center' }}>
        Veritabanı açılamadı.
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 14,
          marginTop: space.md,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  );
}

/**
 * Handles a notification tap or action button. Actions always open the app, so
 * this runs in the foreground where the database is definitely available.
 */
function useNotificationResponses() {
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const handle = async (
      actionIdentifier: string,
      data: NotificationPayload | undefined,
    ): Promise<void> => {
      try {
        if (actionIdentifier === ACTION_OPEN_ALTSTORE) {
          await openAltStore();
          return;
        }
        if (actionIdentifier === ACTION_OPEN_LIST || data?.kind === 'list') {
          router.navigate('/list');
          return;
        }

        if (data?.kind === 'task' && data.sourceId && data.occurrenceKey) {
          if (actionIdentifier === ACTION_COMPLETE) {
            await completeOccurrence(data.sourceId, data.occurrenceKey);
            toast.show({ message: 'Görev tamamlandı' });
            await sync();
            return;
          }
          if (actionIdentifier === ACTION_SNOOZE_10) {
            await snoozeOccurrence(
              data.sourceId,
              data.occurrenceKey,
              new Date(Date.now() + 10 * 60_000),
            );
            toast.show({ message: '10 dakika ertelendi' });
            await sync();
            return;
          }
          const task = await getTask(data.sourceId);
          if (task) router.navigate(`/task/${task.id}`);
          return;
        }

        router.navigate('/');
      } catch (error) {
        await logEvent('error', 'Bildirim yanıtı işlenemedi', { error: String(error) });
      }
    };

    const subscription = addResponseListener((response) => {
      void handle(
        response.actionIdentifier,
        response.notification.request.content.data as NotificationPayload | undefined,
      );
    });

    // A cold start from a notification tap arrives here rather than above.
    void getLaunchResponse().then((response) => {
      if (!response) return;
      void handle(
        response.actionIdentifier,
        response.notification.request.content.data as NotificationPayload | undefined,
      );
    });

    return () => subscription.remove();
  }, [router, toast]);
}

/** Deep links from Shortcuts and Siri (§3.12). */
function useDeepLinks() {
  const toast = useToast();

  useEffect(() => {
    const process = async (url: string): Promise<void> => {
      const result = await handleUrl(url);
      if (result.message) toast.show({ message: result.message });
    };

    void Linking.getInitialURL().then((url) => {
      if (url) void process(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void process(url);
    });
    return () => subscription.remove();
  }, [toast]);
}

/** Everything that must happen each time the app comes to the foreground. */
function useForegroundWork() {
  const didBootstrap = useRef(false);

  useEffect(() => {
    const onForeground = async (): Promise<void> => {
      // AltStore rewrites the profile on refresh; re-read it every time.
      const { changed } = await signature.refresh();
      await sync();
      if (changed) await logEvent('info', 'İmza değişti, hatırlatmalar yenilendi');
      await refreshRegions();
      await runAutoBackupIfDue();
    };

    if (!didBootstrap.current) {
      didBootstrap.current = true;
      void (async () => {
        await seedIfNeeded();
        await registerCategories();
        await registerBackgroundSync();
        await onForeground();
      })();
    }

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void onForeground();
    });
    return () => subscription.remove();
  }, []);
}

function AppShell() {
  const { colors, isDark } = useTheme();
  useNotificationResponses();
  useDeepLinks();
  useForegroundWork();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerLargeTitle: true,
          headerTransparent: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.groupedBackground },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="task/new"
          options={{
            presentation: 'formSheet',
            title: 'Yeni görev',
            headerLargeTitle: false,
            sheetAllowedDetents: [0.75, 1],
          }}
        />
        <Stack.Screen
          name="task/[id]"
          options={{
            presentation: 'formSheet',
            title: 'Görev',
            headerLargeTitle: false,
            sheetAllowedDetents: [0.75, 1],
          }}
        />
        <Stack.Screen
          name="item/[id]"
          options={{
            presentation: 'formSheet',
            title: 'Ürün',
            headerLargeTitle: false,
            sheetAllowedDetents: [0.6, 1],
          }}
        />
        <Stack.Screen
          name="scan"
          options={{ presentation: 'modal', title: 'Barkod tara', headerLargeTitle: false }}
        />
        <Stack.Screen
          name="place/new"
          options={{
            presentation: 'formSheet',
            title: 'Yeni yer',
            headerLargeTitle: false,
            sheetAllowedDetents: [0.75, 1],
          }}
        />
        <Stack.Screen
          name="place/[id]"
          options={{
            presentation: 'formSheet',
            title: 'Yer',
            headerLargeTitle: false,
            sheetAllowedDetents: [0.75, 1],
          }}
        />
        <Stack.Screen
          name="place/pick"
          options={{ presentation: 'modal', title: 'Haritadan seç', headerLargeTitle: false }}
        />
        <Stack.Screen name="diagnostics" options={{ title: 'Tanılama' }} />
        <Stack.Screen
          name="onboarding/index"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  // Derived, not stored: the migration hook already owns this state.
  const ready = success || Boolean(error);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // The onboarding flow is opened once the first render has settled.
  const router = useRouter();
  useEffect(() => {
    if (!success) return;
    void (async () => {
      const done = await getSetting('onboardingDone');
      if (!done) router.navigate('/onboarding');
    })();
  }, [success, router]);

  if (error) return <FatalError message={error.message} />;
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
