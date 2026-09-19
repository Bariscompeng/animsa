/**
 * Scheduled list reminders (§3.5): "remind me about the shopping list on
 * Saturday at 10:00". They only fire when the list actually has something on
 * it — the planner takes care of that.
 */
import { useCallback, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useFocusEffect } from 'expo-router';

import {
  Button,
  Caption,
  Chip,
  EmptyState,
  IconButton,
  Row,
  Screen,
  SectionHeader,
  Separator,
  SwitchRow,
} from '@/components/ui';
import {
  createListRule,
  deleteListRule,
  listReminderRulesAll,
  updateListRule,
} from '@/db/repos/misc';
import { parseTimeKey, toTimeKey } from '@/domain/format';
import { describeRule } from '@/domain/recurrence';
import type { ListReminderRule, RecurrenceRule, Weekday } from '@/domain/types';
import { WEEKDAY_SHORT } from '@/domain/types';
import { scheduleSync } from '@/services/sync';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const PRESETS: { label: string; rule: RecurrenceRule }[] = [
  { label: 'Her gün', rule: { freq: 'daily' } },
  { label: 'Hafta içi', rule: { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] } },
  { label: 'Hafta sonu', rule: { freq: 'weekly', weekdays: [6, 7] } },
  { label: 'Cumartesi', rule: { freq: 'weekly', weekdays: [6] } },
];

export default function ListRulesScreen() {
  const { colors } = useTheme();
  const [rules, setRules] = useState<ListReminderRule[]>([]);
  const [draftRule, setDraftRule] = useState<RecurrenceRule>({ freq: 'weekly', weekdays: [6] });
  const [draftTime, setDraftTime] = useState('10:00');
  const [showPicker, setShowPicker] = useState(false);

  const reload = useCallback(async () => {
    setRules(await listReminderRulesAll());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const add = useCallback(async () => {
    await createListRule(draftRule, draftTime);
    scheduleSync();
    await reload();
  }, [draftRule, draftTime, reload]);

  const toggleWeekday = useCallback((day: Weekday) => {
    setDraftRule((prev) => {
      if (prev.freq !== 'weekly') return { freq: 'weekly', weekdays: [day] };
      const current = new Set(prev.weekdays);
      if (current.has(day)) current.delete(day);
      else current.add(day);
      const weekdays = [...current].sort((a, b) => a - b) as Weekday[];
      return weekdays.length === 0 ? prev : { freq: 'weekly', weekdays };
    });
  }, []);

  const timeAsDate = (): Date => {
    const parsed = parseTimeKey(draftTime) ?? { hour: 10, minute: 0 };
    const date = new Date();
    date.setHours(parsed.hour, parsed.minute, 0, 0);
    return date;
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Liste hatırlatmaları' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <SectionHeader>Kurallar</SectionHeader>
        {rules.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Kural yok"
            description="Örneğin cumartesi 10:00'da listeni hatırlatayım. Liste boşsa bildirim gitmez."
          />
        ) : (
          rules.map((rule) => (
            <View key={rule.id}>
              <SwitchRow
                title={`${describeRule(rule.rrule)} · ${rule.time}`}
                value={rule.enabled}
                onValueChange={(v) => {
                  void updateListRule(rule.id, { enabled: v }).then(() => {
                    scheduleSync();
                    void reload();
                  });
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: 64,
                  top: 0,
                  bottom: 0,
                  justifyContent: 'center',
                }}
              >
                <IconButton
                  name="trash"
                  size={18}
                  color={colors.danger}
                  label="Kuralı sil"
                  onPress={() => {
                    void deleteListRule(rule.id).then(() => {
                      scheduleSync();
                      void reload();
                    });
                  }}
                />
              </View>
              <Separator />
            </View>
          ))
        )}

        <SectionHeader>Yeni kural</SectionHeader>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space.sm,
            paddingHorizontal: space.lg,
          }}
        >
          {PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label}
              tone={describeRule(draftRule) === describeRule(preset.rule) ? 'accent' : 'default'}
              onPress={() => setDraftRule(preset.rule)}
            />
          ))}
        </View>

        {draftRule.freq === 'weekly' ? (
          <View
            style={{
              flexDirection: 'row',
              gap: space.sm,
              paddingHorizontal: space.lg,
              paddingTop: space.md,
            }}
          >
            {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((day) => {
              const selected = draftRule.freq === 'weekly' && draftRule.weekdays.includes(day);
              return (
                <Chip
                  key={day}
                  label={WEEKDAY_SHORT[day]}
                  tone={selected ? 'accent' : 'default'}
                  onPress={() => toggleWeekday(day)}
                />
              );
            })}
          </View>
        ) : null}

        <Row
          title="Saat"
          subtitle={draftTime}
          icon="clock"
          onPress={() => setShowPicker((v) => !v)}
        />
        {showPicker ? (
          <DateTimePicker
            value={timeAsDate()}
            mode="time"
            display="spinner"
            locale="tr-TR"
            is24Hour
            onChange={(_, selected) => {
              if (Platform.OS !== 'ios') setShowPicker(false);
              if (selected) setDraftTime(toTimeKey(selected));
            }}
          />
        ) : null}

        <View style={{ padding: space.lg }}>
          <Button title="Kural ekle" onPress={() => void add()} />
        </View>

        <Caption style={{ paddingHorizontal: space.lg, lineHeight: 20 }}>
          Bildirimin içeriği gönderileceği anda hesaplanır: listede kaç ürün varsa o yazar. Liste
          boşsa bildirim hiç kurulmaz.
        </Caption>

        <View style={{ height: space.xxl, borderRadius: radius.sm, minHeight: MIN_TOUCH }} />
      </ScrollView>
    </Screen>
  );
}
