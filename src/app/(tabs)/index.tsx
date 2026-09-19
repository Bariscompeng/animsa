/**
 * "Bugün" — the home screen (§3.1).
 *
 * Sections: overdue, today, tomorrow, this week. Completed occurrences are
 * hidden behind a toggle so the list stays about what is left to do.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { QuickAddBar } from '@/components/QuickAddBar';
import { SignatureBanner } from '@/components/SignatureBanner';
import { SuggestionCard } from '@/components/SuggestionCard';
import { TaskRow } from '@/components/TaskRow';
import { useToast } from '@/components/Toast';
import { Caption, EmptyState, Row, Screen, SectionHeader, Separator } from '@/components/ui';
import {
  completeOccurrence,
  createTask,
  deleteTask,
  listOccurrenceStates,
  listTasks,
  snoozeOccurrence,
  uncompleteOccurrence,
} from '@/db/repos/tasks';
import { addDays, formatLongDate, startOfDay, toDateKey } from '@/domain/format';
import { expandOccurrences } from '@/domain/recurrence';
import type { Occurrence, OccurrenceState, TaskLike } from '@/domain/types';
import type { ParsedTask } from '@/domain/nlp/parseTaskInput';
import { getSetting } from '@/db/repos/settings';
import { scheduleSync } from '@/services/sync';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Entry = { task: TaskLike; occurrence: Occurrence; overdue: boolean; completed: boolean };
type Section = { title: string; data: Entry[]; collapsible?: boolean };

export default function TodayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [tasks, setTasks] = useState<TaskLike[]>([]);
  const [states, setStates] = useState<OccurrenceState[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [weekExpanded, setWeekExpanded] = useState(false);

  const reload = useCallback(async () => {
    const [nextTasks, nextStates] = await Promise.all([listTasks(), listOccurrenceStates()]);
    setTasks(nextTasks);
    setStates(nextStates);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const refresh = useCallback(() => {
    scheduleSync();
    void reload();
  }, [reload]);

  const sections = useMemo<Section[]>(() => {
    const now = new Date();
    const today = startOfDay(now);
    const windowStart = addDays(today, -365);
    const windowEnd = addDays(today, 8);

    const entries: Entry[] = [];
    for (const task of tasks) {
      const occurrences = expandOccurrences(task, windowStart, windowEnd, states);
      for (const occurrence of occurrences) {
        entries.push({
          task,
          occurrence,
          overdue: occurrence.at.getTime() < now.getTime() && occurrence.date < toDateKey(today),
          completed: false,
        });
      }
    }

    if (showCompleted) {
      const completedStates = states.filter((s) => s.status === 'done');
      for (const state of completedStates) {
        const task = tasks.find((t) => t.id === state.taskId);
        if (!task) continue;
        // Reconstruct the occurrence from its key so the row can render.
        const [datePart, timePart] = state.occurrenceKey.split('T');
        if (!datePart) continue;
        const at = new Date(`${datePart}T${timePart ?? '00:00'}:00`);
        if (Number.isNaN(at.getTime())) continue;
        if (at.getTime() < addDays(today, -7).getTime()) continue;
        entries.push({
          task,
          occurrence: {
            taskId: task.id,
            occurrenceKey: state.occurrenceKey,
            date: datePart,
            time: timePart ?? null,
            at,
            hasTime: Boolean(timePart),
            status: 'done',
            snoozed: false,
          },
          overdue: false,
          completed: true,
        });
      }
    }

    const todayKey = toDateKey(today);
    const tomorrowKey = toDateKey(addDays(today, 1));

    const overdue: Entry[] = [];
    const todayList: Entry[] = [];
    const tomorrowList: Entry[] = [];
    const weekList: Entry[] = [];
    const doneList: Entry[] = [];

    for (const entry of entries) {
      if (entry.completed) {
        doneList.push(entry);
        continue;
      }
      if (entry.occurrence.date < todayKey) overdue.push(entry);
      else if (entry.occurrence.date === todayKey) todayList.push(entry);
      else if (entry.occurrence.date === tomorrowKey) tomorrowList.push(entry);
      else weekList.push(entry);
    }

    // Timed items first, undated ("Gün içinde") at the bottom of each day.
    const order = (list: Entry[]): Entry[] =>
      list.sort((a, b) => {
        if (a.occurrence.hasTime !== b.occurrence.hasTime) return a.occurrence.hasTime ? -1 : 1;
        return a.occurrence.at.getTime() - b.occurrence.at.getTime();
      });

    const out: Section[] = [];
    if (overdue.length > 0) out.push({ title: 'Gecikmiş', data: order(overdue) });
    out.push({ title: 'Bugün', data: order(todayList) });
    if (tomorrowList.length > 0) out.push({ title: 'Yarın', data: order(tomorrowList) });
    if (weekList.length > 0) {
      out.push({
        title: 'Bu hafta',
        data: weekExpanded ? order(weekList) : [],
        collapsible: true,
      });
    }
    if (showCompleted && doneList.length > 0) {
      out.push({ title: 'Tamamlananlar', data: order(doneList) });
    }
    return out;
  }, [tasks, states, showCompleted, weekExpanded]);

  const isEmpty = sections.every((s) => s.data.length === 0) && tasks.length === 0;

  // ----------------------------------------------------------------- actions

  const handleQuickAdd = useCallback(
    async (parsed: ParsedTask) => {
      if (!parsed.title.trim()) return;
      const reminderType = parsed.reminderType ?? 'none';
      await createTask({
        title: parsed.title,
        dueDate: parsed.date ?? toDateKey(new Date()),
        dueTime: parsed.time ?? null,
        rrule: parsed.rule ?? null,
        reminderType,
        // A reminder-less task has nothing to remind early about.
        leadMinutes: reminderType === 'none' ? 0 : await getSetting('defaultLeadMinutes'),
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      refresh();
    },
    [refresh],
  );

  const openForm = useCallback(
    (parsed: ParsedTask, raw: string) => {
      router.navigate({
        pathname: '/task/new',
        params: { draft: raw, title: parsed.title },
      });
    },
    [router],
  );

  const handleToggle = useCallback(
    async (task: TaskLike, occurrence: Occurrence) => {
      const state = states.find(
        (s) => s.taskId === task.id && s.occurrenceKey === occurrence.occurrenceKey,
      );
      if (state?.status === 'done') {
        await uncompleteOccurrence(task.id, occurrence.occurrenceKey);
      } else {
        await completeOccurrence(task.id, occurrence.occurrenceKey);
      }
      refresh();
    },
    [states, refresh],
  );

  const handleSnooze = useCallback(
    (task: TaskLike, occurrence: Occurrence) => {
      const now = new Date();
      const options: { label: string; at: Date }[] = [
        { label: '15 dakika', at: new Date(now.getTime() + 15 * 60_000) },
        { label: '1 saat', at: new Date(now.getTime() + 60 * 60_000) },
        {
          label: 'Bu akşam 20:00',
          at: (() => {
            const d = startOfDay(now);
            d.setHours(20, 0, 0, 0);
            return d.getTime() > now.getTime() ? d : addDays(d, 1);
          })(),
        },
        {
          label: 'Yarın 09:00',
          at: (() => {
            const d = startOfDay(addDays(now, 1));
            d.setHours(9, 0, 0, 0);
            return d;
          })(),
        },
      ];

      Alert.alert('Ertele', task.title, [
        ...options.map((option) => ({
          text: option.label,
          onPress: () => {
            void snoozeOccurrence(task.id, occurrence.occurrenceKey, option.at).then(() => {
              toast.show({ message: `${option.label} ertelendi` });
              refresh();
            });
          },
        })),
        { text: 'Vazgeç', style: 'cancel' as const },
      ]);
    },
    [refresh, toast],
  );

  const handleDelete = useCallback(
    (task: TaskLike) => {
      Alert.alert('Görevi sil', `"${task.title}" silinsin mi?`, [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void deleteTask(task.id).then(() => {
              toast.show({ message: 'Görev silindi' });
              refresh();
            });
          },
        },
      ]);
    },
    [refresh, toast],
  );

  const openTask = useCallback((task: TaskLike) => router.navigate(`/task/${task.id}`), [router]);

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(entry) => `${entry.task.id}:${entry.occurrence.occurrenceKey}`}
        contentInsetAdjustmentBehavior="automatic"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            <Caption style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
              {formatLongDate(new Date())}
            </Caption>
            <SignatureBanner />
            <SuggestionCard onChanged={refresh} />
          </View>
        }
        ListEmptyComponent={
          isEmpty ? (
            <EmptyState
              icon="checklist"
              title="Henüz görev yok"
              description={'Aşağıya yazarak ekle:\n"yarın 9\'da ilaç"'}
            />
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View>
            <SectionHeader>{section.title}</SectionHeader>
            {section.collapsible ? (
              <Row
                title={weekExpanded ? 'Bu haftayı gizle' : 'Bu haftayı göster'}
                icon={weekExpanded ? 'chevron.up' : 'chevron.down'}
                onPress={() => setWeekExpanded((v) => !v)}
              />
            ) : null}
            {section.data.length === 0 && !section.collapsible ? (
              <Caption style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
                Bugün için planlanmış görev yok.
              </Caption>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <TaskRow
            task={item.task}
            occurrence={item.occurrence}
            overdue={item.overdue}
            completed={item.completed}
            onToggle={handleToggle}
            onOpen={openTask}
            onSnooze={handleSnooze}
            onDelete={handleDelete}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListFooterComponent={
          <View style={{ paddingVertical: space.lg }}>
            <Row
              title={showCompleted ? 'Tamamlananları gizle' : 'Tamamlananları göster'}
              icon={showCompleted ? 'eye.slash' : 'eye'}
              onPress={() => setShowCompleted((v) => !v)}
            />
          </View>
        }
        style={{ backgroundColor: colors.groupedBackground }}
      />

      <QuickAddBar onSubmit={handleQuickAdd} onOpenForm={openForm} />
    </Screen>
  );
}
