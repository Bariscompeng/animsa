/**
 * The quick-add row at the bottom of the Today screen.
 *
 * Parses Turkish as the user types and shows what it understood as chips; each
 * chip opens the matching picker so a wrong guess is one tap from being fixed.
 */
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Chip, Icon } from '@/components/ui';
import { useKeyboardHeight } from '@/components/useKeyboardHeight';
import { describeRule } from '@/domain/recurrence';
import { formatRelativeDay, parseDateKey } from '@/domain/format';
import { parseTaskInput, type ParsedTask } from '@/domain/nlp/parseTaskInput';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type QuickAddProps = {
  onSubmit: (parsed: ParsedTask, raw: string) => void | Promise<void>;
  onOpenForm: (parsed: ParsedTask, raw: string) => void;
  placeholder?: string;
};

export function QuickAddBar({ onSubmit, onOpenForm, placeholder }: QuickAddProps) {
  const { colors } = useTheme();
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
   * `endCoordinates.height` is the distance from the bottom of the window to
   * the top of the keyboard, and `tabBarHideOnKeyboard` removes the tab bar at
   * the same moment — so the row's own bottom edge is the window's, and it has
   * to rise by the full keyboard height. Subtracting the tab bar here (as an
   * earlier attempt did) leaves the input buried under the keyboard.
   */
  const lift = keyboardHeight > 0 ? keyboardHeight : 0;

  return (
    <View
      style={{
        marginBottom: lift,
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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingLeft: space.sm,
            paddingRight: space.md,
            borderRadius: radius.pill,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: canSubmit ? colors.accent : colors.separator,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.cardElevated,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="plus" size={14} color={colors.textSecondary} />
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void submit()}
            returnKeyType="done"
            blurOnSubmit={false}
            placeholder={placeholder ?? 'Yeni görev ekle…'}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Hızlı görev ekleme"
            style={{
              flex: 1,
              minHeight: MIN_TOUCH,
              color: colors.text,
              fontSize: 16,
            }}
          />
        </View>

        <Pressable
          onPress={() => (canSubmit ? void submit() : onOpenForm(parsed, text))}
          accessibilityRole="button"
          accessibilityLabel={canSubmit ? 'Görevi ekle' : 'Tam formu aç'}
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
            shadowColor: colors.accent,
            shadowOpacity: 0.4,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          })}
        >
          <Icon name={canSubmit ? 'arrow.up' : 'plus'} size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}
