/**
 * Local notification adapter (§5.4).
 *
 * The app never uses push, so everything here is `expo-notifications`'
 * local-only surface: categories with actions, scheduled triggers keyed by our
 * own deterministic identifiers, and response handling.
 */
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

import { logEvent } from '@/db/repos/misc';

export type NotificationCategoryId = 'task' | 'list' | 'signature' | 'plain';

export const ACTION_COMPLETE = 'ANIMSA_COMPLETE';
export const ACTION_SNOOZE_10 = 'ANIMSA_SNOOZE_10';
export const ACTION_OPEN_LIST = 'ANIMSA_OPEN_LIST';
export const ACTION_OPEN_ALTSTORE = 'ANIMSA_OPEN_ALTSTORE';

export type NotificationPayload = {
  kind: NotificationCategoryId;
  sourceId?: string;
  occurrenceKey?: string;
};

/**
 * Foreground presentation. Banners and sound are shown even while the app is
 * open, because a reminder the user is staring past is a missed reminder.
 */
export function installNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Registers the notification categories and their actions.
 * Every action opens the app: background JS execution is not guaranteed on
 * iOS, so the work happens in the foreground when the app comes up.
 */
export async function registerCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync('task', [
    {
      identifier: ACTION_COMPLETE,
      buttonTitle: 'Tamamlandı',
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_SNOOZE_10,
      buttonTitle: '10 dk ertele',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('list', [
    {
      identifier: ACTION_OPEN_LIST,
      buttonTitle: 'Listeyi aç',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('signature', [
    {
      identifier: ACTION_OPEN_ALTSTORE,
      buttonTitle: "AltStore'u aç",
      options: { opensAppToForeground: true },
    },
  ]);
}

export async function getPermissionStatus(): Promise<Notifications.NotificationPermissionsStatus> {
  return Notifications.getPermissionsAsync();
}

export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: false,
    },
  });
  return result.granted;
}

export type ScheduleInput = {
  key: string;
  fireAt: Date;
  title: string;
  body: string;
  categoryId: NotificationCategoryId;
  data: NotificationPayload;
};

/**
 * Schedules one notification. The identifier is our deterministic key, which
 * is what lets the sync diff desired against actual without extra bookkeeping.
 */
export async function schedule(input: ScheduleInput): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    identifier: input.key,
    content: {
      title: input.title,
      body: input.body,
      sound: true,
      data: input.data as Record<string, unknown>,
      ...(input.categoryId === 'plain' ? {} : { categoryIdentifier: input.categoryId }),
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: input.fireAt,
    },
  });
}

/** Fires a notification immediately — used by location events and tests. */
export async function presentNow(
  title: string,
  body: string,
  categoryId: NotificationCategoryId = 'plain',
  data: NotificationPayload = { kind: 'plain' },
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: data as Record<string, unknown>,
      ...(categoryId === 'plain' ? {} : { categoryIdentifier: categoryId }),
    },
    trigger: null,
  });
}

export async function cancel(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    await logEvent('error', 'Bildirim iptal edilemedi', { identifier, error: String(error) });
  }
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export type PendingNotification = {
  identifier: string;
  title: string;
  body: string;
  fireAt: Date | null;
};

/** Everything iOS currently holds — the sync treats this as ground truth. */
export async function listPending(): Promise<PendingNotification[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.map((n) => {
    const trigger = n.trigger as { type?: string; date?: number | string } | null;
    let fireAt: Date | null = null;
    if (trigger && trigger.date !== undefined && trigger.date !== null) {
      const parsed = new Date(trigger.date);
      fireAt = Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return {
      identifier: n.identifier,
      title: n.content.title ?? '',
      body: n.content.body ?? '',
      fireAt,
    };
  });
}

export function addResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/** The response that launched the app from a cold start, if any. */
export async function getLaunchResponse(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}
