/**
 * Alarm adapter (§6).
 *
 * Wraps the AlarmKit native module and degrades to a plain local notification
 * whenever AlarmKit is unavailable or unauthorised, recording the fallback in
 * the event log so Diagnostics can explain what happened.
 */
import { v5 as uuidv5 } from 'uuid';

import AlarmKit, { type AlarmAuthState } from '@modules/alarm-kit';
import { logEvent } from '@/db/repos/misc';
import type { Weekday } from '@/domain/types';

import * as notifications from './notifications';

/** Namespace for deriving stable alarm UUIDs from planner keys. */
const ALARM_NAMESPACE = '5f3c1d2e-7a4b-4c8f-9e11-2b6d8a0f4c73';

export type AlarmScheduleFixed = { id: string; epochMs: number; title: string };
export type AlarmScheduleWeekly = {
  id: string;
  hour: number;
  minute: number;
  weekdays: Weekday[];
  title: string;
};

/** Derives the AlarmKit UUID for a planner key. Deterministic by design. */
export function alarmIdFor(key: string): string {
  return uuidv5(key, ALARM_NAMESPACE);
}

export function isAvailable(): boolean {
  try {
    return AlarmKit?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

export function getAuthorizationState(): AlarmAuthState {
  try {
    return AlarmKit?.getAuthorizationState() ?? 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function requestAuthorization(): Promise<AlarmAuthState> {
  if (!AlarmKit) return 'unavailable';
  try {
    return await AlarmKit.requestAuthorization();
  } catch (error) {
    await logEvent('error', 'Alarm izni istenemedi', { error: String(error) });
    return 'unavailable';
  }
}

/** True when a real alarm can actually be scheduled right now. */
export function canSchedule(): boolean {
  return isAvailable() && getAuthorizationState() === 'authorized';
}

async function fallbackToNotification(
  key: string,
  fireAt: Date,
  title: string,
  reason: string,
): Promise<void> {
  await logEvent('alarm', 'Alarm bildirime düşürüldü', { key, reason });
  await notifications.schedule({
    key,
    fireAt,
    title,
    body: 'Alarm kurulamadı, bildirim olarak hatırlatılıyor.',
    categoryId: 'task',
    data: { kind: 'task' },
  });
}

export async function scheduleFixed(input: AlarmScheduleFixed, key: string): Promise<boolean> {
  if (!canSchedule()) {
    await fallbackToNotification(
      key,
      new Date(input.epochMs),
      input.title,
      isAvailable() ? 'izin yok' : 'AlarmKit yok',
    );
    return false;
  }
  try {
    await AlarmKit!.scheduleFixed(input.id, input.epochMs, input.title);
    return true;
  } catch (error) {
    await fallbackToNotification(key, new Date(input.epochMs), input.title, String(error));
    return false;
  }
}

export async function scheduleWeekly(input: AlarmScheduleWeekly, key: string): Promise<boolean> {
  if (!canSchedule()) {
    await logEvent('alarm', 'Haftalık alarm kurulamadı', {
      key,
      reason: isAvailable() ? 'izin yok' : 'AlarmKit yok',
    });
    return false;
  }
  try {
    await AlarmKit!.scheduleWeekly(input.id, input.hour, input.minute, input.weekdays, input.title);
    return true;
  } catch (error) {
    await logEvent('error', 'Haftalık alarm hatası', { key, error: String(error) });
    return false;
  }
}

export async function cancel(id: string): Promise<void> {
  if (!AlarmKit) return;
  try {
    await AlarmKit.cancel(id);
  } catch (error) {
    await logEvent('error', 'Alarm iptal edilemedi', { id, error: String(error) });
  }
}

export async function listIds(): Promise<string[]> {
  if (!AlarmKit) return [];
  try {
    return await AlarmKit.listIds();
  } catch {
    return [];
  }
}

export async function cancelAll(): Promise<void> {
  if (!AlarmKit) return;
  try {
    await AlarmKit.cancelAll();
  } catch (error) {
    await logEvent('error', 'Alarmlar temizlenemedi', { error: String(error) });
  }
}

/** Turkish label for the Settings and Diagnostics screens. */
export function describeAuthState(state: AlarmAuthState): string {
  switch (state) {
    case 'authorized':
      return 'İzin verildi';
    case 'denied':
      return 'Reddedildi';
    case 'notDetermined':
      return 'Henüz sorulmadı';
    case 'unavailable':
      return 'Bu cihazda kullanılamıyor';
  }
}
