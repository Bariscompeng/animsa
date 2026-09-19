/**
 * First-run flow (§3.15).
 *
 * Every step can be skipped. A declined permission disables its feature and
 * says so on the relevant screen rather than nagging here.
 */
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useToast } from '@/components/Toast';
import { Button, Caption, Icon, Screen } from '@/components/ui';
import { createPlace, getPlaceByType } from '@/db/repos/places';
import { setSetting } from '@/db/repos/settings';
import { DEFAULT_RADIUS } from '@/domain/regions';
import * as alarms from '@/services/alarms';
import { getCoords, refreshRegions } from '@/services/location';
import {
  requestLocationAlways,
  requestLocationWhenInUse,
  requestNotifications,
} from '@/services/permissions';
import { sync } from '@/services/sync';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Step = 'intro' | 'notifications' | 'alarms' | 'location' | 'locationAlways' | 'home' | 'done';

const ORDER: Step[] = [
  'intro',
  'notifications',
  'alarms',
  'location',
  'locationAlways',
  'home',
  'done',
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>('intro');
  const [busy, setBusy] = useState(false);

  const advance = useCallback(() => {
    const index = ORDER.indexOf(step);
    setStep(ORDER[Math.min(index + 1, ORDER.length - 1)]!);
  }, [step]);

  const finish = useCallback(async () => {
    await setSetting('onboardingDone', true);
    await sync();
    router.back();
  }, [router]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
      } finally {
        setBusy(false);
        advance();
      }
    },
    [advance],
  );

  const saveHome = useCallback(async () => {
    const existing = await getPlaceByType('home');
    if (existing) return;
    const coords = await getCoords();
    if (!coords) {
      toast.show({ message: "Konum alınamadı, sonra Yerler'den ekleyebilirsin", tone: 'error' });
      return;
    }
    await createPlace({
      name: 'Ev',
      type: 'home',
      lat: coords.lat,
      lng: coords.lng,
      radiusM: DEFAULT_RADIUS.home,
    });
    await refreshRegions(coords);
    toast.show({ message: 'Ev konumu kaydedildi' });
  }, [toast]);

  const content = (() => {
    switch (step) {
      case 'intro':
        return {
          icon: 'bell.badge' as const,
          title: 'Anımsa',
          body: 'Günlük görevlerini hatırlatır, ev listeni tutar ve markete yaklaştığında sana seslenir. Her şey telefonunda kalır — hiçbir veri dışarı gitmez.',
          primary: { label: 'Başla', onPress: advance },
          skip: null,
        };
      case 'notifications':
        return {
          icon: 'bell' as const,
          title: 'Bildirimler',
          body: 'Görev hatırlatmaları, alışveriş listesi ve günlük özet için bildirim izni gerekiyor.',
          primary: {
            label: 'İzin ver',
            onPress: () => void run(requestNotifications),
          },
          skip: advance,
        };
      case 'alarms':
        return {
          icon: 'alarm' as const,
          title: 'Alarmlar',
          body: "Alarmlı görevler sessiz modu ve Odak'ı aşar, kilit ekranında tam ekran çalar. İzin vermezsen alarmlar bildirime düşer.",
          primary: {
            label: 'İzin ver',
            onPress: () => void run(alarms.requestAuthorization),
          },
          skip: advance,
        };
      case 'location':
        return {
          icon: 'location' as const,
          title: 'Konum',
          body: 'Yakındaki marketleri gösterebilmek ve kayıtlı yerlerini kullanabilmek için konum iznine ihtiyaç var.',
          primary: {
            label: 'İzin ver',
            onPress: () => void run(requestLocationWhenInUse),
          },
          skip: () => setStep('home'),
        };
      case 'locationAlways':
        return {
          icon: 'location.fill' as const,
          title: '"Her Zaman" konum',
          body: 'Markete yaklaştığında veya evden çıktığında uygulama kapalıyken de hatırlatabilmem için "Her Zaman" izni gerekiyor. Bu izin olmadan yer hatırlatmaları hiç çalışmaz.',
          primary: {
            label: '"Her Zaman" ver',
            onPress: () => void run(requestLocationAlways),
          },
          skip: advance,
        };
      case 'home':
        return {
          icon: 'house' as const,
          title: 'Ev konumun',
          body: 'Şu an evdeysen buraya "Ev" olarak kaydedeyim; evden çıkarken kontrol listeni hatırlatabileyim. Sonradan Yerler sekmesinden de ekleyebilirsin.',
          primary: {
            label: 'Buradayım, kaydet',
            onPress: () => void run(saveHome),
          },
          skip: advance,
        };
      case 'done':
        return {
          icon: 'checkmark.circle' as const,
          title: 'Hazırsın',
          body: 'Bugün sekmesinin altına "yarın 9\'da ilaç" gibi yazarak görev ekleyebilirsin. Liste sekmesine "2 kg domates" yazman yeterli.',
          primary: { label: 'Başlayalım', onPress: () => void finish() },
          skip: null,
        };
    }
  })();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: space.xl,
        }}
      >
        <View style={{ alignItems: 'center', gap: space.lg }}>
          <Icon name={content.icon} size={56} color={colors.accent} />
          <Text
            style={{
              color: colors.text,
              fontSize: 28,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            {content.title}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 17,
              lineHeight: 24,
              textAlign: 'center',
            }}
          >
            {content.body}
          </Text>
        </View>

        <View style={{ gap: space.md, marginTop: space.xxl }}>
          <Button title={content.primary.label} onPress={content.primary.onPress} loading={busy} />
          {content.skip ? (
            <Button title="Şimdilik atla" variant="plain" onPress={content.skip} />
          ) : null}
        </View>

        <Caption style={{ textAlign: 'center', marginTop: space.xl }}>
          {ORDER.indexOf(step) + 1} / {ORDER.length}
        </Caption>
      </ScrollView>
    </Screen>
  );
}
