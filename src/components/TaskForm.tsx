/**
 * The full task form, shared by "new" and "edit" (§3.1).
 * Presented as a form sheet so it never loses the list behind it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  Body,
  Button,
  Caption,
  Chip,
  Row,
  SectionHeader,
  Separator,
  SwitchRow,
} from '@/components/ui';
import { listPlaces, type PlaceFull } from '@/db/repos/places';
import {
  combineDateTime,
  formatLongDate,
  parseDateKey,
  toDateKey,
  toTimeKey,
} from '@/domain/format';
import { describeRule } from '@/domain/recurrence';
import type {
  LocationTrigger,
  RecurrenceRule,
  ReminderType,
  TaskLike,
  Weekday,
} from '@/domain/types';
import { WEEKDAY_SHORT } from '@/domain/types';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type TaskFormValue = {
  title: string;
  notes: string;
  dueDate: string | null;
  dueTime: string | null;
  rrule: RecurrenceRule | null;
  reminderType: ReminderType;
  leadMinutes: number;
  important: boolean;
  locationTrigger: LocationTrigger | null;
  onHomeExit: boolean;
  onHomeArrive: boolean;
};

export const EMPTY_TASK: TaskFormValue = {
  title: '',
  notes: '',
  dueDate: null,
  dueTime: null,
  rrule: null,
  reminderType: 'none',
  leadMinutes: 0,
  important: false,
  locationTrigger: null,
  onHomeExit: false,
  onHomeArrive: false,
};

export function taskToForm(task: TaskLike): TaskFormValue {
  return {
    title: task.title,
    notes: task.notes ?? '',
    dueDate: task.dueDate ?? null,
    dueTime: task.dueTime ?? null,
    rrule: task.rrule ?? null,
    reminderType: task.reminderType,
    leadMinutes: task.leadMinutes,
    important: task.important ?? false,
    locationTrigger: task.locationTrigger ?? null,
    onHomeExit: task.onHomeExit ?? false,
    onHomeArrive: task.onHomeArrive ?? false,
  };
}

const LEAD_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'Yok', minutes: 0 },
  { label: '5 dk', minutes: 5 },
  { label: '15 dk', minutes: 15 },
  { label: '30 dk', minutes: 30 },
  { label: '1 saat', minutes: 60 },
  { label: '1 gün', minutes: 1440 },
];

const REMINDER_OPTIONS: { label: string; value: ReminderType }[] = [
  { label: 'Yok', value: 'none' },
  { label: 'Bildirim', value: 'notification' },
  { label: 'Alarm', value: 'alarm' },
];

type RuleKind =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekend'
  | 'weekly'
  | 'everyNDays'
  | 'monthlyDay'
  | 'monthlyLastDay'
  | 'yearly';

function kindOf(rule: RecurrenceRule | null): RuleKind {
  if (!rule) return 'none';
  switch (rule.freq) {
    case 'daily':
      return (rule.interval ?? 1) > 1 ? 'everyNDays' : 'daily';
    case 'weekly': {
      const days = [...rule.weekdays].sort((a, b) => a - b);
      if (days.length === 5 && days.every((d) => d <= 5)) return 'weekdays';
      if (days.length === 2 && days[0] === 6 && days[1] === 7) return 'weekend';
      return 'weekly';
    }
    case 'monthlyDay':
      return 'monthlyDay';
    case 'monthlyLastDay':
      return 'monthlyLastDay';
    case 'yearly':
      return 'yearly';
  }
}

const RULE_OPTIONS: { label: string; kind: RuleKind }[] = [
  { label: 'Yok', kind: 'none' },
  { label: 'Her gün', kind: 'daily' },
  { label: 'Hafta içi', kind: 'weekdays' },
  { label: 'Hafta sonu', kind: 'weekend' },
  { label: 'Seçili günler', kind: 'weekly' },
  { label: 'N günde bir', kind: 'everyNDays' },
  { label: 'Her ayın X. günü', kind: 'monthlyDay' },
  { label: 'Ayın son günü', kind: 'monthlyLastDay' },
  { label: 'Her yıl', kind: 'yearly' },
];

export function TaskForm({
  value,
  onChange,
  onSubmit,
  onDelete,
  submitLabel,
}: {
  value: TaskFormValue;
  onChange: (next: TaskFormValue) => void;
  onSubmit: () => void;
  onDelete?: () => void;
  submitLabel: string;
}) {
  const { colors } = useTheme();
  const [places, setPlaces] = useState<PlaceFull[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    void listPlaces().then(setPlaces);
  }, []);

  const set = useCallback(
    <K extends keyof TaskFormValue>(key: K, next: TaskFormValue[K]) => {
      onChange({ ...value, [key]: next });
    },
    [onChange, value],
  );

  const ruleKind = useMemo(() => kindOf(value.rrule), [value.rrule]);

  const applyRuleKind = useCallback(
    (kind: RuleKind) => {
      const anchor = value.dueDate ? parseDateKey(value.dueDate) : new Date();
      const today = anchor ?? new Date();
      switch (kind) {
        case 'none':
          set('rrule', null);
          return;
        case 'daily':
          set('rrule', { freq: 'daily' });
          return;
        case 'weekdays':
          set('rrule', { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] });
          return;
        case 'weekend':
          set('rrule', { freq: 'weekly', weekdays: [6, 7] });
          return;
        case 'weekly': {
          const day = (((today.getDay() + 6) % 7) + 1) as Weekday;
          set('rrule', { freq: 'weekly', weekdays: [day] });
          return;
        }
        case 'everyNDays':
          set('rrule', { freq: 'daily', interval: 2 });
          return;
        case 'monthlyDay':
          set('rrule', { freq: 'monthlyDay', day: today.getDate() });
          return;
        case 'monthlyLastDay':
          set('rrule', { freq: 'monthlyLastDay' });
          return;
        case 'yearly':
          set('rrule', { freq: 'yearly', month: today.getMonth() + 1, day: today.getDate() });
          return;
      }
    },
    [set, value.dueDate],
  );

  const toggleWeekday = useCallback(
    (day: Weekday) => {
      if (!value.rrule || value.rrule.freq !== 'weekly') return;
      const current = new Set(value.rrule.weekdays);
      if (current.has(day)) current.delete(day);
      else current.add(day);
      const weekdays = [...current].sort((a, b) => a - b) as Weekday[];
      if (weekdays.length === 0) return; // never leave a weekly rule empty
      set('rrule', { ...value.rrule, weekdays });
    },
    [set, value.rrule],
  );

  const pickerDate =
    combineDateTime(value.dueDate ?? toDateKey(new Date()), value.dueTime) ?? new Date();

  const submit = useCallback(() => {
    if (!value.title.trim()) {
      Alert.alert('Başlık gerekli', 'Göreve bir başlık yaz.');
      return;
    }
    onSubmit();
  }, [onSubmit, value.title]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ padding: space.lg, gap: space.md, backgroundColor: colors.card }}>
        <TextInput
          value={value.title}
          onChangeText={(t) => set('title', t)}
          placeholder="Ne yapılacak?"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Görev başlığı"
          autoFocus={!value.title}
          style={{
            minHeight: MIN_TOUCH,
            color: colors.text,
            fontSize: 20,
            fontWeight: '600',
          }}
        />
        <TextInput
          value={value.notes}
          onChangeText={(t) => set('notes', t)}
          placeholder="Not (isteğe bağlı)"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Görev notu"
          multiline
          style={{ minHeight: MIN_TOUCH, color: colors.text, fontSize: 16 }}
        />
      </View>

      {/* ------------------------------------------------------------ when */}
      <SectionHeader>Ne zaman</SectionHeader>
      <Row
        title="Tarih"
        subtitle={
          value.dueDate ? formatLongDate(parseDateKey(value.dueDate) ?? new Date()) : 'Belirtilmedi'
        }
        icon="calendar"
        onPress={() => setShowDatePicker((v) => !v)}
        right={
          value.dueDate ? (
            <Button title="Kaldır" variant="plain" onPress={() => set('dueDate', null)} />
          ) : undefined
        }
      />
      {showDatePicker ? (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="inline"
          locale="tr-TR"
          accentColor={colors.accent}
          onChange={(_, selected) => {
            if (Platform.OS !== 'ios') setShowDatePicker(false);
            if (selected) set('dueDate', toDateKey(selected));
          }}
        />
      ) : null}
      <Separator />
      <Row
        title="Saat"
        subtitle={value.dueTime ?? 'Gün içinde'}
        icon="clock"
        onPress={() => setShowTimePicker((v) => !v)}
        right={
          value.dueTime ? (
            <Button title="Kaldır" variant="plain" onPress={() => set('dueTime', null)} />
          ) : undefined
        }
      />
      {showTimePicker ? (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="spinner"
          locale="tr-TR"
          is24Hour
          onChange={(_, selected) => {
            if (Platform.OS !== 'ios') setShowTimePicker(false);
            if (selected) {
              set('dueTime', toTimeKey(selected));
              if (!value.dueDate) set('dueDate', toDateKey(selected));
            }
          }}
        />
      ) : null}

      {/* ---------------------------------------------------------- repeat */}
      <SectionHeader>Tekrar</SectionHeader>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: space.sm,
          paddingHorizontal: space.lg,
        }}
      >
        {RULE_OPTIONS.map((option) => (
          <Chip
            key={option.kind}
            label={option.label}
            tone={ruleKind === option.kind ? 'accent' : 'default'}
            onPress={() => applyRuleKind(option.kind)}
          />
        ))}
      </View>

      {value.rrule?.freq === 'weekly' ? (
        <View
          style={{
            flexDirection: 'row',
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingTop: space.md,
          }}
        >
          {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((day) => {
            const selected = value.rrule?.freq === 'weekly' && value.rrule.weekdays.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleWeekday(day)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={WEEKDAY_SHORT[day]}
                style={{
                  flex: 1,
                  minHeight: MIN_TOUCH,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: selected ? colors.accent : colors.groupedBackground,
                }}
              >
                <Text
                  style={{
                    color: selected ? '#FFFFFF' : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {WEEKDAY_SHORT[day]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {value.rrule?.freq === 'daily' && (value.rrule.interval ?? 1) > 1 ? (
        <View
          style={{
            flexDirection: 'row',
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingTop: space.md,
          }}
        >
          {[2, 3, 4, 5, 7, 10, 14].map((n) => (
            <Chip
              key={n}
              label={`${n}`}
              tone={
                value.rrule?.freq === 'daily' && value.rrule.interval === n ? 'accent' : 'default'
              }
              onPress={() => set('rrule', { freq: 'daily', interval: n })}
              accessibilityLabel={`${n} günde bir`}
            />
          ))}
        </View>
      ) : null}

      {value.rrule ? (
        <Caption style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          {describeRule(value.rrule)}
        </Caption>
      ) : null}

      {/* -------------------------------------------------------- reminder */}
      <SectionHeader>Hatırlatma</SectionHeader>
      <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg }}>
        {REMINDER_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            tone={value.reminderType === option.value ? 'accent' : 'default'}
            onPress={() => set('reminderType', option.value)}
          />
        ))}
      </View>
      {value.reminderType === 'alarm' ? (
        <Caption style={{ paddingHorizontal: space.lg, paddingTop: space.sm, lineHeight: 19 }}>
          {"Alarm sessiz modu ve Odak'ı aşar, kilit ekranında tam ekran çalar."}
        </Caption>
      ) : null}

      {value.reminderType !== 'none' ? (
        <>
          <SectionHeader>Önceden hatırlat</SectionHeader>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: space.sm,
              paddingHorizontal: space.lg,
            }}
          >
            {LEAD_OPTIONS.map((option) => (
              <Chip
                key={option.minutes}
                label={option.label}
                tone={value.leadMinutes === option.minutes ? 'accent' : 'default'}
                onPress={() => set('leadMinutes', option.minutes)}
              />
            ))}
          </View>
        </>
      ) : null}

      {/* -------------------------------------------------------- location */}
      <SectionHeader>Konum</SectionHeader>
      <SwitchRow
        title="Evden çıkarken hatırlat"
        icon="door.left.hand.open"
        value={value.onHomeExit}
        onValueChange={(v) => set('onHomeExit', v)}
      />
      <Separator />
      <SwitchRow
        title="Eve gelince hatırlat"
        icon="house"
        value={value.onHomeArrive}
        onValueChange={(v) => set('onHomeArrive', v)}
      />
      {places.length > 0 ? (
        <>
          <Separator />
          <Row
            title="Bir yere varınca / çıkınca"
            subtitle={
              value.locationTrigger
                ? `${places.find((p) => p.id === value.locationTrigger?.placeId)?.name ?? 'Yer'} · ${
                    value.locationTrigger.on === 'enter' ? 'varınca' : 'çıkınca'
                  }`
                : 'Seçili değil'
            }
            icon="location"
            right={
              value.locationTrigger ? (
                <Button
                  title="Kaldır"
                  variant="plain"
                  onPress={() => set('locationTrigger', null)}
                />
              ) : undefined
            }
          />
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: space.sm,
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
            }}
          >
            {places.map((place) => (
              <Chip
                key={place.id}
                label={place.name}
                tone={value.locationTrigger?.placeId === place.id ? 'accent' : 'default'}
                onPress={() =>
                  set(
                    'locationTrigger',
                    value.locationTrigger?.placeId === place.id
                      ? null
                      : { placeId: place.id, on: 'enter' },
                  )
                }
              />
            ))}
          </View>
          {value.locationTrigger ? (
            <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg }}>
              <Chip
                label="Varınca"
                tone={value.locationTrigger.on === 'enter' ? 'accent' : 'default'}
                onPress={() => set('locationTrigger', { ...value.locationTrigger!, on: 'enter' })}
              />
              <Chip
                label="Çıkınca"
                tone={value.locationTrigger.on === 'exit' ? 'accent' : 'default'}
                onPress={() => set('locationTrigger', { ...value.locationTrigger!, on: 'exit' })}
              />
            </View>
          ) : null}
        </>
      ) : null}

      <SectionHeader>Diğer</SectionHeader>
      <SwitchRow
        title="Önemli"
        icon="flag"
        value={value.important}
        onValueChange={(v) => set('important', v)}
      />

      <View style={{ padding: space.lg, gap: space.md }}>
        <Button title={submitLabel} onPress={submit} />
        {onDelete ? <Button title="Görevi sil" variant="danger" onPress={onDelete} /> : null}
      </View>

      {value.reminderType !== 'none' && !value.dueDate ? (
        <Body muted style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
          Hatırlatma için bir tarih seçmen gerekiyor.
        </Body>
      ) : null}
    </ScrollView>
  );
}
