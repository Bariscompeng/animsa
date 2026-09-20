/**
 * One occurrence in the Today list.
 *
 * Rows sit inside a rounded card group rather than running edge to edge, and
 * carry a leading icon that names the kind of task. State is shown by tint —
 * red wash for overdue, green for done — so a glance is enough.
 *
 * Swipe right completes, swipe left reveals snooze and delete. Memoised
 * because the list re-renders on every database change.
 */
import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import type { SFSymbol } from 'expo-symbols';

import { Badge } from '@/components/design';
import { Icon } from '@/components/ui';
import { toTimeKey } from '@/domain/format';
import { describeRule } from '@/domain/recurrence';
import type { Occurrence, TaskLike } from '@/domain/types';
import { hueSoft, hues, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type TaskRowProps = {
  task: TaskLike;
  occurrence: Occurrence;
  overdue?: boolean;
  completed?: boolean;
  onToggle: (task: TaskLike, occurrence: Occurrence) => void;
  onOpen: (task: TaskLike, occurrence: Occurrence) => void;
  onSnooze: (task: TaskLike, occurrence: Occurrence) => void;
  onDelete: (task: TaskLike, occurrence: Occurrence) => void;
};

/**
 * A glyph that hints at what the task is about. Purely decorative — it comes
 * from keywords, so a wrong guess costs nothing.
 */
function glyphFor(task: TaskLike): SFSymbol {
  const t = task.title.toLocaleLowerCase('tr-TR');
  if (/fatura|ödeme|kira|banka|para/.test(t)) return 'bolt.fill';
  if (/ilaç|vitamin|hap|doktor|diş|hastane|randevu/.test(t)) return 'cross.case.fill';
  if (/çamaşır|bulaşık|temizlik|ütü|ev/.test(t)) return 'house.fill';
  if (/market|alışveriş|süt|ekmek/.test(t)) return 'cart.fill';
  if (/spor|koş|yürüyüş|antrenman/.test(t)) return 'figure.run';
  if (/ara|telefon|çağrı/.test(t)) return 'phone.fill';
  if (/toplantı|iş|rapor|sunum/.test(t)) return 'briefcase.fill';
  if (/araba|servis|benzin/.test(t)) return 'car.fill';
  return 'doc.text.fill';
}

function TaskRowComponent({
  task,
  occurrence,
  overdue,
  completed,
  onToggle,
  onOpen,
  onSnooze,
  onDelete,
}: TaskRowProps) {
  const { colors } = useTheme();

  const toggle = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onToggle(task, occurrence);
  }, [onToggle, task, occurrence]);

  const timeLabel = occurrence.hasTime ? toTimeKey(occurrence.at) : 'Gün içinde';

  const background = completed ? hueSoft('green') : overdue ? hueSoft('red') : colors.card;

  const timeColor = completed
    ? colors.textTertiary
    : overdue
      ? hues.red
      : occurrence.hasTime
        ? colors.accent
        : colors.textSecondary;

  const renderRight = () => (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={() => onSnooze(task, occurrence)}
        accessibilityRole="button"
        accessibilityLabel={`${task.title} görevini ertele`}
        style={{
          width: 88,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="clock.badge" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 13, marginTop: 4 }}>Ertele</Text>
      </Pressable>
      <Pressable
        onPress={() => onDelete(task, occurrence)}
        accessibilityRole="button"
        accessibilityLabel={`${task.title} görevini sil`}
        style={{
          width: 88,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="trash" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 13, marginTop: 4 }}>Sil</Text>
      </Pressable>
    </View>
  );

  const renderLeft = () => (
    <View
      style={{
        flex: 1,
        backgroundColor: hues.green,
        justifyContent: 'center',
        paddingLeft: space.lg,
      }}
    >
      <Icon name="checkmark" color="#FFFFFF" />
    </View>
  );

  return (
    <Swipeable
      renderRightActions={renderRight}
      renderLeftActions={renderLeft}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') toggle();
      }}
      overshootLeft={false}
    >
      <Pressable
        onPress={() => onOpen(task, occurrence)}
        accessibilityRole="button"
        accessibilityLabel={`${task.title}, ${timeLabel}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.md,
          paddingVertical: space.md + 2,
          backgroundColor: pressed ? colors.cardElevated : background,
        })}
      >
        <Pressable
          onPress={toggle}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: Boolean(completed) }}
          accessibilityLabel={
            completed ? `${task.title} tamamlandı, geri al` : `${task.title} görevini tamamla`
          }
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: completed ? hues.green : overdue ? hues.red : colors.separator,
            backgroundColor: completed ? hues.green : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {completed ? <Icon name="checkmark" size={15} color="#FFFFFF" /> : null}
        </Pressable>

        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon
              name={glyphFor(task)}
              size={15}
              color={completed ? colors.textTertiary : colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: completed ? colors.textTertiary : colors.text,
                fontSize: 16,
                fontWeight: '600',
                textDecorationLine: completed ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {occurrence.hasTime ? <Icon name="alarm" size={12} color={timeColor} /> : null}
            <Text style={{ color: timeColor, fontSize: 13, fontWeight: '500' }}>
              {overdue ? 'Dün ' : ''}
              {timeLabel}
            </Text>

            {task.rrule ? (
              <>
                <Icon name="repeat" size={12} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                  {describeRule(task.rrule)}
                </Text>
              </>
            ) : null}

            {task.reminderType === 'alarm' ? (
              <Icon name="bell.fill" size={12} color={colors.accent} />
            ) : null}
            {task.onHomeArrive ? (
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Eve gelince</Text>
            ) : null}
            {task.onHomeExit ? (
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Evden çıkarken</Text>
            ) : null}
            {occurrence.snoozed ? (
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>· ertelendi</Text>
            ) : null}
          </View>
        </View>

        {task.important && !completed ? <Badge label="Önemli" hue="amber" /> : null}
        <Icon name="chevron.right" size={13} color={colors.textTertiary} />
      </Pressable>
    </Swipeable>
  );
}

export const TaskRow = memo(TaskRowComponent);
