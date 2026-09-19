/** Quiet hours, summary time and evening preview time. */
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack } from 'expo-router';

import { Caption, Row, Screen, SectionHeader, Separator, SwitchRow } from '@/components/ui';
import { loadSettings, setSetting } from '@/db/repos/settings';
import { parseTimeKey, toTimeKey } from '@/domain/format';
import type { SettingsShape } from '@/services/settingsKeys';
import { scheduleSync } from '@/services/sync';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Field = 'start' | 'end' | 'summary' | 'preview';

function timeToDate(time: string): Date {
  const parsed = parseTimeKey(time) ?? { hour: 9, minute: 0 };
  const date = new Date();
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  return date;
}

export default function QuietHoursScreen() {
  const { colors } = useTheme();
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [editing, setEditing] = useState<Field | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const update = useCallback(
    async <K extends keyof SettingsShape>(key: K, value: SettingsShape[K]) => {
      await setSetting(key, value);
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
      scheduleSync();
    },
    [],
  );

  if (!settings) return <Screen />;

  const currentValue = (field: Field): string => {
    switch (field) {
      case 'start':
        return settings.quietHours.start;
      case 'end':
        return settings.quietHours.end;
      case 'summary':
        return settings.summaryTime;
      case 'preview':
        return settings.eveningPreviewTime;
    }
  };

  const apply = (field: Field, time: string): void => {
    switch (field) {
      case 'start':
        void update('quietHours', { ...settings.quietHours, start: time });
        return;
      case 'end':
        void update('quietHours', { ...settings.quietHours, end: time });
        return;
      case 'summary':
        void update('summaryTime', time);
        return;
      case 'preview':
        void update('eveningPreviewTime', time);
        return;
    }
  };

  const picker = (field: Field) =>
    editing === field ? (
      <DateTimePicker
        value={timeToDate(currentValue(field))}
        mode="time"
        display="spinner"
        locale="tr-TR"
        is24Hour
        onChange={(_, selected) => {
          if (Platform.OS !== 'ios') setEditing(null);
          if (selected) apply(field, toTimeKey(selected));
        }}
      />
    ) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sessiz saatler' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <SectionHeader>Sessiz saatler</SectionHeader>
        <SwitchRow
          title="Sessiz saatler"
          subtitle="Bu aralıkta otomatik bildirimler ertelenir"
          icon="moon"
          value={settings.quietHours.enabled}
          onValueChange={(v) => void update('quietHours', { ...settings.quietHours, enabled: v })}
        />
        {settings.quietHours.enabled ? (
          <>
            <Separator />
            <Row
              title="Başlangıç"
              subtitle={settings.quietHours.start}
              onPress={() => setEditing(editing === 'start' ? null : 'start')}
            />
            {picker('start')}
            <Separator />
            <Row
              title="Bitiş"
              subtitle={settings.quietHours.end}
              onPress={() => setEditing(editing === 'end' ? null : 'end')}
            />
            {picker('end')}
          </>
        ) : null}

        <Caption style={{ padding: space.lg, lineHeight: 20, color: colors.textSecondary }}>
          Kendi verdiğin saatler ve tüm alarmlar sessiz saatlerden etkilenmez. Yalnızca uygulamanın
          kendiliğinden ürettiği hatırlatmalar (günlük özet, son kullanma tarihi, öneriler) sessiz
          saat bitimine kaydırılır; konum bildirimleri ise hiç gösterilmez.
        </Caption>

        <SectionHeader>Günlük özet</SectionHeader>
        <Row
          title="Özet saati"
          subtitle={settings.summaryTime}
          icon="sun.max"
          onPress={() => setEditing(editing === 'summary' ? null : 'summary')}
        />
        {picker('summary')}

        <SectionHeader>Akşam önizlemesi</SectionHeader>
        <Row
          title="Önizleme saati"
          subtitle={settings.eveningPreviewTime}
          icon="moon.stars"
          onPress={() => setEditing(editing === 'preview' ? null : 'preview')}
        />
        {picker('preview')}

        <View style={{ height: space.xxl }} />
      </ScrollView>
    </Screen>
  );
}
