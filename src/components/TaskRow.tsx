/**
 * One occurrence in the Today list.
 *
 * Swipe right completes, swipe left reveals snooze and delete. The row is
 * memoised because the list re-renders on every database change.
 */
import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';

import { Icon } from '@/components/ui';
import { toTimeKey } from '@/domain/format';
import type { Occurrence, TaskLike } from '@/domain/types';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
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
        backgroundColor: colors.success,
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
          minHeight: MIN_TOUCH + 12,
          paddingLeft: space.lg - 4,
          paddingRight: space.lg,
          paddingVertical: space.md,
          backgroundColor: pressed ? colors.groupedBackground : colors.card,
          borderLeftWidth: 4,
          borderLeftColor: overdue ? colors.danger : task.important ? colors.accent : 'transparent',
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
            width: 26,
            height: 26,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: completed ? colors.success : colors.separator,
            backgroundColor: completed ? colors.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {completed ? <Icon name="checkmark" size={14} color="#FFFFFF" /> : null}
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={2}
            style={{
              color: completed ? colors.textTertiary : colors.text,
              fontSize: 17,
              textDecorationLine: completed ? 'line-through' : 'none',
            }}
          >
            {task.title}
          </Text>
          <Text
            style={{
              color: overdue ? colors.danger : colors.textSecondary,
              fontSize: 14,
              marginTop: 2,
            }}
          >
            {overdue ? 'Gecikmiş · ' : ''}
            {timeLabel}
            {occurrence.snoozed ? ' · ertelendi' : ''}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          {task.rrule ? <Icon name="repeat" size={14} color={colors.textTertiary} /> : null}
          {task.reminderType === 'alarm' ? (
            <Icon name="alarm.fill" size={14} color={colors.accent} />
          ) : null}
          {task.locationTrigger || task.onHomeExit || task.onHomeArrive ? (
            <Icon name="location.fill" size={14} color={colors.textTertiary} />
          ) : null}
        </View>
      </Pressable>
    </Swipeable>
  );
}

export const TaskRow = memo(TaskRowComponent);
