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

import { HeroAction, HeroHeader, SectionTitle } from '@/components/design';
import { QuickAccess } from '@/components/QuickAccess';
import { QuickAddBar } from '@/components/QuickAddBar';
import { SignatureBanner } from '@/components/SignatureBanner';
import { SuggestionCard } from '@/components/SuggestionCard';
import { TaskRow } from '@/components/TaskRow';
import { useToast } from '@/components/Toast';
import { CardGroup, Caption, EmptyState, Row, Screen, Separator } from '@/components/ui';
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
import { radius, space, type Hue } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { SFSymbol } from 'expo-symbols';

type Entry = { task: TaskLike; occurrence: Occurrence; overdue: boolean; completed: boolean };
type Section = {
  title: string;
  data: Entry[];
  collapsible?: boolean;
  icon: SFSymbol;
  hue: Hue;
  /** Right-aligned count, e.g. "3 kaldı". */
  count?: string;
};

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
    if (overdue.length > 0) {
      out.push({
        title: 'Gecikmiş',
        data: order(overdue),
        icon: 'target',
        hue: 'red',
        count: `${overdue.length} görev`,
      });
    }
    out.push({
      title: 'Bugün',
      data: order(todayList),
      icon: 'calendar',
      hue: 'green',
      count: todayList.length > 0 ? `${todayList.length} kaldı` : undefined,
    });
    if (tomorrowList.length > 0) {
      out.push({
        title: 'Yarın',
        data: order(tomorrowList),
        icon: 'sunrise',
        hue: 'amber',
        count: `${tomorrowList.length} görev`,
      });
    }
    if (weekList.length > 0) {
      out.push({
        title: 'Bu hafta',
        data: weekExpanded ? order(weekList) : [],
        collapsible: true,
        icon: 'calendar.badge.clock',
        hue: 'purple',
        count: `${weekList.length} görev`,
      });
    }
    if (showCompleted && doneList.length > 0) {
      out.push({
        title: 'Tamamlananlar',
        data: order(doneList),
        icon: 'checkmark.seal',
        hue: 'slate',
        count: `${doneList.length} görev`,
      });
    }
    return out;
  }, [tasks, states, showCompleted, weekExpanded]);

  const isEmpty = sections.every((s) => s.data.length === 0) && tasks.length === 0;

  /** Outstanding items today and earlier — what the header summarises. */
  const openCount = useMemo(
    () =>
      sections
        .filter((s) => s.title === 'Gecikmiş' || s.title === 'Bugün')
        .reduce((total, s) => total + s.data.length, 0),
    [sections],
  );

  /** Figures behind the Quick Access tiles. */
  const totals = useMemo(() => {
    const live = tasks.filter((t) => !t.archivedAt);
    const upcoming = sections
      .filter((s) => s.title === 'Yarın' || s.title === 'Bu hafta')
      .reduce((total, s) => total + s.data.length, 0);
    return {
      all: live.length,
      important: live.filter((t) => t.important).length,
      soon: upcoming,
    };
  }, [tasks, sections]);

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
      <HeroHeader
        eyebrow={formatLongDate(new Date())}
        title="Bugün"
        subtitle={
          openCount === 0 ? 'Bugün için planlanmış bir şey yok' : `${openCount} görev seni bekliyor`
        }
        actions={
          <>
            <HeroAction
              icon="magnifyingglass"
              label="Ara"
              onPress={() => router.navigate('/list')}
            />
            <HeroAction
              icon="gearshape"
              label="Ayarlar"
              onPress={() => router.navigate('/settings')}
            />
          </>
        }
      />
      <SectionList
        sections={sections}
        keyExtractor={(entry) => `${entry.task.id}:${entry.occurrence.occurrenceKey}`}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            <SignatureBanner />
            <QuickAccess
              tiles={[
                {
                  key: 'all',
                  icon: 'calendar',
                  hue: 'blue',
                  title: 'Tüm Görevler',
                  count: totals.all,
                  onPress: () => setWeekExpanded(true),
                },
                {
                  key: 'important',
                  icon: 'star.fill',
                  hue: 'amber',
                  title: 'Önemli',
                  count: totals.important,
                  onPress: () => router.navigate('/task/new'),
                },
                {
                  key: 'soon',
                  icon: 'clock.fill',
                  hue: 'purple',
                  title: 'Yaklaşan',
                  count: totals.soon,
                  onPress: () => setWeekExpanded(true),
                },
              ]}
            />
            <SuggestionCard onChanged={refresh} />
          </View>
        }
        ListEmptyComponent={
          isEmpty ? (
            <EmptyState
              icon="checklist"
              title="Henüz görev yok"
              description={
                'Aşağıdaki satıra Türkçe yazman yeterli:\n"yarın 9\'da ilaç" · "her sabah 8\'de vitamin"'
              }
              action={{ label: 'Görev ekle', onPress: () => router.navigate('/task/new') }}
            />
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View>
            <SectionTitle
              icon={section.icon}
              hue={section.hue}
              title={section.title}
              count={section.count}
              onPress={section.collapsible ? () => setWeekExpanded((v) => !v) : undefined}
            />
            {section.data.length === 0 && !section.collapsible ? (
              <Caption style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
                Bugün için planlanmış görev yok.
              </Caption>
            ) : null}
          </View>
        )}
        renderItem={({ item, index, section }) => {
          // Rows form one rounded card per section: only the outer corners are
          // rounded, so the group reads as a single surface.
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View
              style={{
                marginHorizontal: space.lg,
                overflow: 'hidden',
                borderTopLeftRadius: first ? radius.lg : 0,
                borderTopRightRadius: first ? radius.lg : 0,
                borderBottomLeftRadius: last ? radius.lg : 0,
                borderBottomRightRadius: last ? radius.lg : 0,
              }}
            >
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
            </View>
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={{ marginHorizontal: space.lg, backgroundColor: colors.card }}>
            <Separator />
          </View>
        )}
        ListFooterComponent={
          <View style={{ paddingTop: space.lg, paddingBottom: space.xxl }}>
            <CardGroup>
              <Row
                title={showCompleted ? 'Tamamlananları gizle' : 'Tamamlananları göster'}
                icon={showCompleted ? 'eye.slash' : 'eye'}
                onPress={() => setShowCompleted((v) => !v)}
              />
            </CardGroup>
          </View>
        }
        style={{ backgroundColor: colors.groupedBackground }}
      />

      <QuickAddBar onSubmit={handleQuickAdd} onOpenForm={openForm} />
    </Screen>
  );
}
