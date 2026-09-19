/** Edit an existing task. */
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { TaskForm, taskToForm, type TaskFormValue } from '@/components/TaskForm';
import { useToast } from '@/components/Toast';
import { Loading } from '@/components/ui';
import { deleteTask, getTask, updateTask } from '@/db/repos/tasks';
import { scheduleSync } from '@/services/sync';

export default function EditTaskScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [value, setValue] = useState<TaskFormValue | null>(null);

  useEffect(() => {
    if (!id) return;
    void getTask(id).then((task) => {
      if (task) setValue(taskToForm(task));
      else router.back();
    });
  }, [id, router]);

  const submit = useCallback(async () => {
    if (!id || !value) return;
    await updateTask(id, {
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
    toast.show({ message: 'Görev güncellendi' });
    router.back();
  }, [id, router, toast, value]);

  const remove = useCallback(() => {
    if (!id || !value) return;
    Alert.alert('Görevi sil', `"${value.title}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void deleteTask(id).then(() => {
            scheduleSync();
            toast.show({ message: 'Görev silindi' });
            router.back();
          });
        },
      },
    ]);
  }, [id, router, toast, value]);

  if (!value) return <Loading />;

  return (
    <TaskForm
      value={value}
      onChange={setValue}
      onSubmit={() => void submit()}
      onDelete={remove}
      submitLabel="Güncelle"
    />
  );
}
