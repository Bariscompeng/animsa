/**
 * Diagnostics (§3.14).
 *
 * With no Mac and no Xcode console, this screen is the primary way to see what
 * the app actually scheduled, what it is monitoring and what went wrong.
 */
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';

import { useToast } from '@/components/Toast';
import {
  Body,
  Button,
  Caption,
  Chip,
  Row,
  Screen,
  SectionHeader,
  Separator,
} from '@/components/ui';
import { listPlaces, type PlaceFull } from '@/db/repos/places';
import { recentEvents, type EventType, type LogEntry } from '@/db/repos/misc';
import { loadSettings } from '@/db/repos/settings';
import { distanceMeters, type Coords } from '@/domain/regions';
import { formatDateTime, formatDuration } from '@/domain/format';
import * as alarms from '@/services/alarms';
import { simulateEvent } from '@/services/geofenceHandler';
import { getCoords, isMonitoring, refreshRegions } from '@/services/location';
import * as notifications from '@/services/notifications';
import { snapshot, PERMISSION_LABEL, type PermissionsSnapshot } from '@/services/permissions';
import * as signature from '@/services/signature';
import { sync } from '@/services/sync';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const LOG_FILTERS: { label: string; value: EventType | 'all' }[] = [
  { label: 'Tümü', value: 'all' },
  { label: 'Senkron', value: 'sync' },
  { label: 'Konum', value: 'location' },
  { label: 'Bildirim', value: 'notification' },
  { label: 'Alarm', value: 'alarm' },
  { label: 'Hata', value: 'error' },
];

export default function DiagnosticsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [pending, setPending] = useState<notifications.PendingNotification[]>([]);
  const [alarmIds, setAlarmIds] = useState<string[]>([]);
  const [places, setPlaces] = useState<PlaceFull[]>([]);
  const [here, setHere] = useState<Coords | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsSnapshot | null>(null);
  const [events, setEvents] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<EventType | 'all'>('all');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [signatureLabel, setSignatureLabel] = useState('Bilinmiyor');

  const reload = useCallback(async () => {
    const [nextPending, nextAlarms, nextPlaces, nextPermissions, nextSettings, nextMonitoring] =
      await Promise.all([
        notifications.listPending(),
        alarms.listIds(),
        listPlaces(),
        snapshot(),
        loadSettings(),
        isMonitoring(),
      ]);

    setPending(nextPending.sort((a, b) => (a.fireAt?.getTime() ?? 0) - (b.fireAt?.getTime() ?? 0)));
    setAlarmIds(nextAlarms);
    setPlaces(nextPlaces);
    setPermissions(nextPermissions);
    setMonitoring(nextMonitoring);
    setLastSync(nextSettings.lastSyncSummary);
    setLastSyncAt(nextSettings.lastSyncAt);

    const status = await signature.currentStatus();
    setSignatureLabel(
      status.expiresAt
        ? `${formatDuration(status.msRemaining ?? 0)} kaldı (${formatDateTime(status.expiresAt)})`
        : 'Bilinmiyor (geliştirme derlemesi olabilir)',
    );

    setHere(await getCoords());
  }, []);

  const reloadEvents = useCallback(async () => {
    setEvents(await recentEvents(200, filter === 'all' ? undefined : filter));
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void reloadEvents();
    }, [reload, reloadEvents]),
  );

  // ------------------------------------------------------------ test actions

  const testNotification = useCallback(async () => {
    const granted = await notifications.requestPermission();
    if (!granted) {
      toast.show({ message: 'Bildirim izni yok', tone: 'error' });
      return;
    }
    await notifications.schedule({
      key: `test:notification:${Date.now()}`,
      fireAt: new Date(Date.now() + 5000),
      title: '🔔 Test bildirimi',
      body: '5 saniye önce kuruldu. Bildirimler çalışıyor.',
      categoryId: 'plain',
      data: { kind: 'plain' },
    });
    toast.show({ message: '5 saniye sonra gelecek' });
  }, [toast]);

  const testAlarm = useCallback(async () => {
    const state = await alarms.requestAuthorization();
    if (state !== 'authorized') {
      Alert.alert(
        'Alarm kurulamadı',
        `Alarm durumu: ${alarms.describeAuthState(state)}. Alarmlı görevler bildirime düşecek.`,
      );
      return;
    }
    const key = `test:alarm:${Date.now()}`;
    const ok = await alarms.scheduleFixed(
      { id: alarms.alarmIdFor(key), epochMs: Date.now() + 60_000, title: 'Anımsa test alarmı' },
      key,
    );
    toast.show({
      message: ok ? '1 dakika sonra çalacak' : 'Alarm kurulamadı, bildirime düşüldü',
      tone: ok ? 'default' : 'error',
    });
    await reload();
  }, [reload, toast]);

  const fakeEvent = useCallback(() => {
    if (places.length === 0) {
      toast.show({ message: 'Önce bir yer ekle', tone: 'error' });
      return;
    }
    Alert.alert('Sahte konum olayı', 'Hangi yere GİRİŞ olayı üretilsin?', [
      ...places.slice(0, 8).map((place) => ({
        text: place.name,
        onPress: () => {
          void simulateEvent(place.id, 'enter').then((result) => {
            toast.show({ message: `Sonuç: ${result}` });
            void reloadEvents();
          });
        },
      })),
      { text: 'Vazgeç', style: 'cancel' as const },
    ]);
  }, [places, reloadEvents, toast]);

  const shareLog = useCallback(async () => {
    const lines = events.map(
      (e) =>
        `${formatDateTime(new Date(e.at))} [${e.type}] ${e.message}${
          e.payloadJson ? ` ${e.payloadJson}` : ''
        }`,
    );
    try {
      const file = new File(Paths.cache as Directory, 'animsa-log.txt');
      if (file.exists) file.delete();
      file.create();
      file.write(lines.join('\n'));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text' });
      }
    } catch {
      toast.show({ message: 'Log paylaşılamadı', tone: 'error' });
    }
  }, [events, toast]);

  return (
    <Screen>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        {/* ------------------------------------------------------- overview */}
        <SectionHeader>Durum</SectionHeader>
        <Row
          title="Son senkron"
          subtitle={
            lastSync
              ? `${lastSync}${lastSyncAt ? ` · ${formatDateTime(new Date(lastSyncAt))}` : ''}`
              : 'Henüz çalışmadı'
          }
          icon="arrow.triangle.2.circlepath"
        />
        <Separator />
        <Row title="İmza" subtitle={signatureLabel} icon="signature" />
        <Separator />
        <Row title="Bölge izleme" subtitle={monitoring ? 'Çalışıyor' : 'Durdu'} icon="location" />

        {/* ---------------------------------------------------- permissions */}
        {permissions ? (
          <>
            <SectionHeader>İzinler</SectionHeader>
            <Row title="Bildirim" subtitle={PERMISSION_LABEL[permissions.notifications]} />
            <Separator />
            <Row
              title="Alarm"
              subtitle={`${PERMISSION_LABEL[permissions.alarms]} · AlarmKit ${
                alarms.isAvailable() ? 'var' : 'yok'
              }`}
            />
            <Separator />
            <Row title="Konum" subtitle={PERMISSION_LABEL[permissions.location]} />
            <Separator />
            <Row title="Kamera" subtitle={PERMISSION_LABEL[permissions.camera]} />
          </>
        ) : null}

        {/* ------------------------------------------------------- pending */}
        <SectionHeader>Bekleyen bildirimler ({pending.length})</SectionHeader>
        {pending.length === 0 ? (
          <Caption style={{ paddingHorizontal: space.lg }}>Kurulu bildirim yok.</Caption>
        ) : (
          pending.slice(0, 40).map((n) => (
            <View key={n.identifier} style={{ paddingHorizontal: space.lg, paddingVertical: 6 }}>
              <Body numberOfLines={1}>{n.title}</Body>
              <Caption numberOfLines={1}>
                {n.fireAt ? formatDateTime(n.fireAt) : 'zaman bilinmiyor'} · {n.identifier}
              </Caption>
            </View>
          ))
        )}

        <SectionHeader>Kurulu alarmlar ({alarmIds.length})</SectionHeader>
        {alarmIds.length === 0 ? (
          <Caption style={{ paddingHorizontal: space.lg }}>Kurulu alarm yok.</Caption>
        ) : (
          alarmIds.map((id) => (
            <Caption key={id} style={{ paddingHorizontal: space.lg, paddingVertical: 2 }}>
              {id}
            </Caption>
          ))
        )}

        {/* -------------------------------------------------------- regions */}
        <SectionHeader>İzlenen yerler ({places.length})</SectionHeader>
        {places.map((place) => (
          <View key={place.id} style={{ paddingHorizontal: space.lg, paddingVertical: 6 }}>
            <Body numberOfLines={1}>{place.name}</Body>
            <Caption>
              {place.type} · {place.radiusM} m
              {here
                ? ` · ${Math.round(distanceMeters(here, { lat: place.lat, lng: place.lng }))} m uzakta`
                : ''}
              {place.enabled ? '' : ' · kapalı'}
            </Caption>
          </View>
        ))}

        {/* ---------------------------------------------------------- tests */}
        <SectionHeader>Testler</SectionHeader>
        <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
          <Button
            title="5 sn sonra test bildirimi"
            variant="secondary"
            onPress={() => void testNotification()}
          />
          <Button
            title="1 dk sonra test alarmı"
            variant="secondary"
            onPress={() => void testAlarm()}
          />
          <Button title="Seçili yere sahte GİRİŞ olayı" variant="secondary" onPress={fakeEvent} />
          <Button
            title="Senkronu şimdi çalıştır"
            variant="secondary"
            onPress={() => {
              void sync().then((result) => {
                toast.show({
                  message: `+${result.scheduled} kuruldu, −${result.cancelled} iptal`,
                });
                void reload();
                void reloadEvents();
              });
            }}
          />
          <Button
            title="Bölgeleri yeniden seç"
            variant="secondary"
            onPress={() => {
              void refreshRegions().then((regions) => {
                toast.show({ message: `${regions.length} bölge izleniyor` });
                void reload();
              });
            }}
          />
          <Button title="Log'u paylaş" variant="secondary" onPress={() => void shareLog()} />
        </View>

        {/* ------------------------------------------------------------ log */}
        <SectionHeader>Olay kaydı</SectionHeader>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingBottom: space.md,
          }}
        >
          {LOG_FILTERS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              tone={filter === option.value ? 'accent' : 'default'}
              onPress={() => setFilter(option.value)}
            />
          ))}
        </View>

        {events.length === 0 ? (
          <Caption style={{ paddingHorizontal: space.lg }}>Kayıt yok.</Caption>
        ) : (
          events.map((event) => (
            <View key={event.id} style={{ paddingHorizontal: space.lg, paddingVertical: 5 }}>
              <Text
                style={{
                  color: event.type === 'error' ? colors.danger : colors.text,
                  fontSize: 14,
                }}
              >
                {event.message}
              </Text>
              <Caption>
                {formatDateTime(new Date(event.at))} · {event.type}
              </Caption>
            </View>
          ))
        )}

        <View style={{ padding: space.lg }}>
          <Button title="Kapat" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
