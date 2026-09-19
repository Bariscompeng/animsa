/**
 * The quick-add row at the bottom of the Today screen.
 *
 * Parses Turkish as the user types and shows what it understood as chips; each
 * chip opens the matching picker so a wrong guess is one tap from being fixed.
 */
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';

import { Chip, IconButton } from '@/components/ui';
import { describeRule } from '@/domain/recurrence';
import { formatRelativeDay, parseDateKey } from '@/domain/format';
import { parseTaskInput, type ParsedTask } from '@/domain/nlp/parseTaskInput';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type QuickAddProps = {
  onSubmit: (parsed: ParsedTask, raw: string) => void | Promise<void>;
  onOpenForm: (parsed: ParsedTask, raw: string) => void;
  placeholder?: string;
};

export function QuickAddBar({ onSubmit, onOpenForm, placeholder }: QuickAddProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');

  const parsed = useMemo(() => parseTaskInput(text, new Date()), [text]);

  const chips = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    if (parsed.date) {
      const date = parseDateKey(parsed.date);
      if (date) out.push({ key: 'date', label: `📅 ${formatRelativeDay(date, new Date())}` });
    }
    if (parsed.time) out.push({ key: 'time', label: `⏰ ${parsed.time}` });
    if (parsed.rule) out.push({ key: 'rule', label: `🔁 ${describeRule(parsed.rule)}` });
    if (parsed.reminderType === 'alarm') out.push({ key: 'reminder', label: '🔔 Alarm' });
    else if (parsed.reminderType === 'notification') {
      out.push({ key: 'reminder', label: '🔔 Bildirim' });
    }
    return out;
  }, [parsed]);

  const submit = async (): Promise<void> => {
    if (!parsed.title.trim()) return;
    const raw = text;
    setText('');
    await onSubmit(parsed, raw);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.separator,
          backgroundColor: colors.background,
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
          paddingBottom: space.md,
        }}
      >
        {chips.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: space.sm,
              marginBottom: space.sm,
            }}
          >
            {chips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.label}
                tone="accent"
                onPress={() => onOpenForm(parsed, text)}
                accessibilityLabel={`${chip.label}, düzenlemek için dokun`}
              />
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void submit()}
            returnKeyType="done"
            placeholder={placeholder ?? "yarın 9'da ilaç"}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Hızlı görev ekleme"
            style={{
              flex: 1,
              minHeight: 44,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.groupedBackground,
              color: colors.text,
              fontSize: 17,
            }}
          />
          <IconButton
            name="plus.circle.fill"
            size={30}
            color={colors.accent}
            label="Tam formu aç"
            onPress={() => onOpenForm(parsed, text)}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
