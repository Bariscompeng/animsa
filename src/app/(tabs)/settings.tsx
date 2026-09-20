/**
 * "Ayarlar" (§3.13) — permissions, reminders, location, list, signature, data
 * and the advanced tools.
 */
import { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { ChoiceRow } from '@/components/ChoiceRow';
import { HeroHeader } from '@/components/design';
import { useToast } from '@/components/Toast';
import {
  Button,
  Caption,
  CardGroup,
  Row,
  Screen,
  SectionHeader,
  Separator,
  SwitchRow,
} from '@/components/ui';
import { loadSettings, setSetting } from '@/db/repos/settings';
import { formatDateTime, formatDuration } from '@/domain/format';
import type { SettingsShape } from '@/services/settingsKeys';
import type { SignatureStatus } from '@/domain/provision';
import { openAltStore } from '@/services/altstore';
import { pickBackup, restoreBackup, shareBackup } from '@/services/backup';
import {
  PERMISSION_LABEL,
  openSystemSettings,
  requestAlarms,
  requestCamera,
  requestLocationAlways,
  requestNotifications,
  snapshot,
  type PermissionsSnapshot,
} from '@/services/permissions';
import * as signature from '@/services/signature';
import { rebuildAll } from '@/services/sync';
import { space } from '@/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();

  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [permissions, setPermissions] = useState<PermissionsSnapshot | null>(null);
  const [signatureState, setSignatureState] = useState<SignatureStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [nextSettings, nextPermissions, nextSignature] = await Promise.all([
      loadSettings(),
      snapshot(),
      signature.currentStatus(),
    ]);
    setSettings(nextSettings);
    setPermissions(nextPermissions);
    setSignatureState(nextSignature);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const update = useCallback(
    async <K extends keyof SettingsShape>(key: K, value: SettingsShape[K]) => {
      await setSetting(key, value);
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  const backup = useCallback(async () => {
    setBusy(true);
    try {
      await shareBackup();
    } catch {
      toast.show({ message: 'Yedek alınamadı', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const restore = useCallback(async () => {
    const picked = await pickBackup();
    if (!picked.ok) {
      if (picked.error !== 'Seçim iptal edildi.') {
        toast.show({ message: picked.error, tone: 'error' });
      }
      return;
    }

    const { summary, backup: file, fileName } = picked.picked;
    Alert.alert(
      'Yedeği geri yükle',
      `${fileName}\n\n${summary.items} ürün, ${summary.tasks} görev, ${summary.places} yer.\n\nMevcut tüm veriler silinip bu yedekle değiştirilecek.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Geri yükle',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void restoreBackup(file)
              .then(() => rebuildAll())
              .then(() => {
                toast.show({ message: 'Yedek geri yüklendi' });
                void reload();
              })
              .catch(() => toast.show({ message: 'Geri yükleme başarısız', tone: 'error' }))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }, [reload, toast]);

  const rebuild = useCallback(() => {
    Alert.alert(
      'Tüm hatırlatmaları yeniden kur',
      'Kurulu tüm bildirim ve alarmlar silinip baştan kurulacak. Verilerin etkilenmez.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Yeniden kur',
          onPress: () => {
            setBusy(true);
            void rebuildAll()
              .then((result) => toast.show({ message: `${result.scheduled} hatırlatma kuruldu` }))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }, [toast]);

  if (!settings || !permissions) return <Screen />;

  const signatureLabel = signatureState?.expiresAt
    ? `${formatDuration(signatureState.msRemaining ?? 0)} kaldı (${formatDateTime(signatureState.expiresAt)})`
    : 'Bilinmiyor';

  return (
    <Screen>
      <HeroHeader title="Ayarlar" subtitle="Uygulamayı kendine göre ayarla ⚙️" />
      <ScrollView>
        {/* ------------------------------------------------------ permissions */}
        <SectionHeader>İzinler</SectionHeader>
        <CardGroup>
          <Row
            title="Bildirimler"
            subtitle={PERMISSION_LABEL[permissions.notifications]}
            icon="bell"
            onPress={() => {
              if (permissions.notifications === 'undetermined') {
                void requestNotifications().then(() => void reload());
              } else {
                void openSystemSettings();
              }
            }}
          />
          <Separator />
          <Row
            title="Alarmlar"
            subtitle={PERMISSION_LABEL[permissions.alarms]}
            icon="alarm"
            onPress={() => {
              if (permissions.alarms === 'undetermined') {
                void requestAlarms().then(() => void reload());
              } else if (permissions.alarms !== 'unavailable') {
                void openSystemSettings();
              }
            }}
          />
          <Separator />
          <Row
            title="Konum"
            subtitle={
              permissions.location === 'partial'
                ? '"Kullanırken" verildi — yer hatırlatmaları için "Her Zaman" gerekiyor'
                : PERMISSION_LABEL[permissions.location]
            }
            icon="location"
            onPress={() => {
              if (permissions.location === 'partial') {
                void requestLocationAlways().then(() => void reload());
              } else {
                void openSystemSettings();
              }
            }}
          />
          <Separator />
          <Row
            title="Kamera"
            subtitle={PERMISSION_LABEL[permissions.camera]}
            icon="camera"
            onPress={() => {
              if (permissions.camera === 'undetermined') {
                void requestCamera().then(() => void reload());
              } else {
                void openSystemSettings();
              }
            }}
          />
        </CardGroup>

        {/* -------------------------------------------------------- reminders */}
        <SectionHeader>Hatırlatmalar</SectionHeader>
        <CardGroup>
          <Row
            title="Sessiz saatler"
            subtitle={
              settings.quietHours.enabled
                ? `${settings.quietHours.start} – ${settings.quietHours.end}`
                : 'Kapalı'
            }
            icon="moon"
            onPress={() => router.navigate('/settings/quiet-hours')}
          />
          <Separator />
          <SwitchRow
            title="Günlük özet"
            subtitle={settings.summaryEnabled ? `Her gün ${settings.summaryTime}` : 'Kapalı'}
            icon="sun.max"
            value={settings.summaryEnabled}
            onValueChange={(v) => void update('summaryEnabled', v)}
          />
          <Separator />
          <SwitchRow
            title="Akşam önizlemesi"
            subtitle={
              settings.eveningPreviewEnabled ? `Her akşam ${settings.eveningPreviewTime}` : 'Kapalı'
            }
            icon="moon.stars"
            value={settings.eveningPreviewEnabled}
            onValueChange={(v) => void update('eveningPreviewEnabled', v)}
          />
          <Separator />
          <ChoiceRow
            title="Varsayılan önceden hatırlat"
            subtitle="Yeni görevlerde önceden hatırlatma varsayılanı"
            icon="bell.badge"
            value={settings.defaultLeadMinutes}
            options={[
              { label: 'Yok', value: 0 },
              { label: '5 dk', value: 5 },
              { label: '15 dk', value: 15 },
              { label: '30 dk', value: 30 },
              { label: '1 saat', value: 60 },
              { label: '1 gün', value: 1440 },
            ]}
            onChange={(v) => void update('defaultLeadMinutes', v)}
          />
          <Separator />
          <SwitchRow
            title="Son kullanma hatırlatmaları"
            subtitle="Tarihten 2 gün ve 1 gün önce 09:00"
            icon="calendar.badge.clock"
            value={settings.expiryRemindersEnabled}
            onValueChange={(v) => void update('expiryRemindersEnabled', v)}
          />
        </CardGroup>

        {/* --------------------------------------------------------- location */}
        <SectionHeader>Konum</SectionHeader>
        <CardGroup>
          <SwitchRow
            title="Otomatik market keşfi"
            subtitle="Kaydetmediğin marketler de OpenStreetMap'ten bulunur"
            icon="map"
            value={settings.autoDiscoverPlaces}
            onValueChange={(v) => void update('autoDiscoverPlaces', v)}
          />
          <Separator />
          <ChoiceRow
            title="Konum bildirimi bekleme süresi"
            subtitle="İki konum bildirimi arasındaki en kısa süre"
            icon="timer"
            value={settings.locationCooldownMinutes}
            options={[
              { label: '5 dk', value: 5 },
              { label: '10 dk', value: 10 },
              { label: '20 dk', value: 20 },
              { label: '45 dk', value: 45 },
              { label: '2 saat', value: 120 },
            ]}
            onChange={(v) => void update('locationCooldownMinutes', v)}
          />
          <Separator />
          <Row
            title="Evden çıkarken listesi"
            subtitle="Anahtar, cüzdan, çöp…"
            icon="door.left.hand.open"
            onPress={() => router.navigate('/settings/home-exit')}
          />
        </CardGroup>

        {/* ------------------------------------------------------------- list */}
        <SectionHeader>Liste</SectionHeader>
        <CardGroup>
          <Row
            title="Kategori sırası"
            subtitle="Markette gezdiğin reyon sırası"
            icon="list.bullet.indent"
            onPress={() => router.navigate('/settings/categories')}
          />
          <Separator />
          <SwitchRow
            title="Önerileri listeye otomatik ekle"
            subtitle="Bitmek üzere olan ürünler sorulmadan eklensin"
            icon="sparkles"
            value={settings.autoAddSuggestions}
            onValueChange={(v) => void update('autoAddSuggestions', v)}
          />
          <Separator />
          <Row
            title="Liste hatırlatmaları"
            subtitle="Belirli gün ve saatlerde listeyi hatırlat"
            icon="clock"
            onPress={() => router.navigate('/settings/list-rules')}
          />
        </CardGroup>

        {/* -------------------------------------------------------- signature */}
        <SectionHeader>İmza</SectionHeader>
        <CardGroup>
          <Row title="İmza geçerliliği" subtitle={signatureLabel} icon="signature" />
          <Separator />
          <Row
            title="AltStore'u aç"
            subtitle="Süre dolmadan Yenile'ye bas"
            icon="arrow.clockwise"
            onPress={() => {
              void openAltStore().then((opened) => {
                if (!opened) {
                  Alert.alert(
                    'AltStore bulunamadı',
                    "AltStore kurulu değil gibi görünüyor. docs/KURULUM.md'deki adımlara bak.",
                  );
                }
              });
            }}
          />
        </CardGroup>

        {/* ------------------------------------------------------------- data */}
        <SectionHeader>Veri</SectionHeader>
        <CardGroup>
          <Row
            title="Yedekle"
            subtitle="Tüm veriyi JSON olarak dışa aktar"
            icon="square.and.arrow.up"
            onPress={() => void backup()}
          />
          <Separator />
          <Row
            title="Geri yükle"
            subtitle="Bir yedek dosyasından geri dön"
            icon="square.and.arrow.down"
            onPress={() => void restore()}
          />
          <Separator />
          <SwitchRow
            title="Otomatik yedek"
            subtitle={
              settings.lastAutoBackupAt
                ? `Son: ${formatDateTime(new Date(settings.lastAutoBackupAt))}`
                : 'Haftada bir, Dosyalar › Anımsa › Yedekler'
            }
            icon="externaldrive"
            value={settings.autoBackupEnabled}
            onValueChange={(v) => void update('autoBackupEnabled', v)}
          />
          <Caption style={{ paddingHorizontal: space.lg, paddingTop: space.sm, lineHeight: 19 }}>
            {"Uygulamayı silersen bu klasör de silinir; önemli yedekleri iCloud Drive'a kopyala."}
          </Caption>
        </CardGroup>

        {/* --------------------------------------------------------- advanced */}
        <SectionHeader>Gelişmiş</SectionHeader>
        <CardGroup>
          <Row
            title="Tüm hatırlatmaları yeniden kur"
            icon="arrow.triangle.2.circlepath"
            onPress={rebuild}
          />
          <Separator />
          <Row
            title="Tanılama"
            icon="stethoscope"
            onPress={() => router.navigate('/diagnostics')}
          />
          <Separator />
          <Row
            title="Tanıtımı tekrar göster"
            icon="sparkles"
            onPress={() => {
              void setSetting('onboardingDone', false).then(() => router.navigate('/onboarding'));
            }}
          />
        </CardGroup>

        <View style={{ padding: space.xl, alignItems: 'center' }}>
          <Caption>
            Anımsa {Constants.expoConfig?.version ?? '1.0.0'} (
            {Constants.expoConfig?.ios?.buildNumber ?? '1'})
          </Caption>
          <Caption style={{ marginTop: 4 }}>
            {settings.lastSyncSummary
              ? `Son senkron: ${settings.lastSyncSummary}`
              : 'Henüz senkron çalışmadı'}
          </Caption>
        </View>

        {busy ? (
          <View style={{ padding: space.lg }}>
            <Button title="Çalışıyor…" variant="secondary" loading onPress={() => {}} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
