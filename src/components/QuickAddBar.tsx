/**
 * The quick-add row at the bottom of the Today screen.
 *
 * Parses Turkish as the user types and shows what it understood as chips; each
 * chip opens the matching picker so a wrong guess is one tap from being fixed.
 */
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, Icon, IconButton } from '@/components/ui';
import { useKeyboardHeight } from '@/components/useKeyboardHeight';
import { describeRule } from '@/domain/recurrence';
import { formatRelativeDay, parseDateKey } from '@/domain/format';
import { parseTaskInput, type ParsedTask } from '@/domain/nlp/parseTaskInput';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Height of the JS tab bar the quick-add row sits above. */
const TAB_BAR_HEIGHT = 49;

export type QuickAddProps = {
  onSubmit: (parsed: ParsedTask, raw: string) => void | Promise<void>;
  onOpenForm: (parsed: ParsedTask, raw: string) => void;
  placeholder?: string;
};

export function QuickAddBar({ onSubmit, onOpenForm, placeholder }: QuickAddProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
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

  const canSubmit = parsed.title.trim().length > 0;

  /**
   * When the keyboard is up, lift the bar clear of it — minus the tab bar,
   * which react-navigation hides at the same moment, and minus the home
   * indicator inset the keyboard already covers.
   */
  const lift =
    keyboardHeight > 0 ? Math.max(0, keyboardHeight - TAB_BAR_HEIGHT - insets.bottom) : 0;

  return (
    <View
      style={{
        marginBottom: lift,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
        backgroundColor: colors.background,
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: space.md,
      }}
    >
      {chips.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space.sm,
            marginBottom: space.md,
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
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: colors.groupedBackground,
            borderWidth: 1,
            borderColor: canSubmit ? colors.accent : 'transparent',
          }}
        >
          <Icon name="plus.circle" size={18} color={colors.textTertiary} />
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void submit()}
            returnKeyType="done"
            blurOnSubmit={false}
            placeholder={placeholder ?? "yarın 9'da ilaç"}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Hızlı görev ekleme"
            style={{
              flex: 1,
              minHeight: MIN_TOUCH,
              color: colors.text,
              fontSize: 17,
            }}
          />
        </View>

        {canSubmit ? (
          <IconButton
            name="arrow.up.circle.fill"
            size={32}
            color={colors.accent}
            label="Görevi ekle"
            onPress={() => void submit()}
          />
        ) : (
          <IconButton
            name="slider.horizontal.3"
            size={24}
            color={colors.textSecondary}
            label="Tam formu aç"
            onPress={() => onOpenForm(parsed, text)}
          />
        )}
      </View>

      {canSubmit ? (
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: 12,
            marginTop: space.sm,
            textAlign: 'center',
          }}
        >
          Ayrıntı için çipe dokun · tam form için sağdaki düğme
        </Text>
      ) : null}
    </View>
  );
}
