/**
 * New task sheet. When opened from the quick-add bar it inherits whatever the
 * parser already understood, so nothing the user typed is lost.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { EMPTY_TASK, TaskForm, type TaskFormValue } from '@/components/TaskForm';
import { useToast } from '@/components/Toast';
import { getSetting } from '@/db/repos/settings';
import { createTask } from '@/db/repos/tasks';
import { parseTaskInput } from '@/domain/nlp/parseTaskInput';
import { scheduleSync } from '@/services/sync';

export default function NewTaskScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ draft?: string }>();

  const [value, setValue] = useState<TaskFormValue>(() => {
    const draft = params.draft;
    if (!draft) return EMPTY_TASK;
    const parsed = parseTaskInput(draft, new Date());
    return {
      ...EMPTY_TASK,
      title: parsed.title,
      dueDate: parsed.date ?? null,
      dueTime: parsed.time ?? null,
      rrule: parsed.rule ?? null,
      reminderType: parsed.reminderType ?? 'none',
    };
  });

  // Pull in the user's default lead time, unless the draft already set one.
  useFocusEffect(
    useCallback(() => {
      void getSetting('defaultLeadMinutes').then((minutes) => {
        setValue((prev) =>
          prev.leadMinutes === 0 && prev.reminderType !== 'none'
            ? { ...prev, leadMinutes: minutes }
            : prev,
        );
      });
    }, []),
  );

  const submit = useCallback(async () => {
    await createTask({
      title: value.title,
      notes: value.notes || null,
      dueDate: value.dueDate,
      dueTime: value.dueTime,
      rrule: value.rrule,
      reminderType: value.reminderType,
      leadMinutes: value.leadMinutes,
      important: value.important,
      locationTrigger: value.locationTrigger,
      onHomeExit: value.onHomeExit,
      onHomeArrive: value.onHomeArrive,
    });
    scheduleSync();
    toast.show({ message: 'Görev eklendi' });
    router.back();
  }, [router, toast, value]);

  return (
    <TaskForm
      value={value}
      onChange={setValue}
      onSubmit={() => void submit()}
      submitLabel="Kaydet"
    />
  );
}
