/**
 * Deep links (§3.12) — the Shortcuts/Siri surface, with no native code.
 *
 *   animsa://ekle?urun=süt
 *   animsa://gorev?metin=yarın 9'da ilaç
 *   animsa://liste
 *   animsa://bugun
 */
import { router } from 'expo-router';

import { addToList } from '@/db/repos/items';
import { logEvent } from '@/db/repos/misc';
import { createTask } from '@/db/repos/tasks';
import { parseItemInput } from '@/domain/nlp/parseItemInput';
import { parseTaskInput } from '@/domain/nlp/parseTaskInput';

import { scheduleSync } from './sync';

export type DeepLinkResult = {
  handled: boolean;
  /** Short Turkish confirmation to show as a toast. */
  message?: string;
};

/**
 * Handles one incoming URL.
 *
 * Navigation happens here too, so the user lands on the screen that shows the
 * result of what they just asked for.
 */
export async function handleUrl(url: string): Promise<DeepLinkResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { handled: false };
  }

  // `animsa://ekle?...` parses with host = "ekle" and an empty path.
  const action = (parsed.host || parsed.pathname.replace(/^\//, '')).toLocaleLowerCase('tr-TR');
  const params = parsed.searchParams;

  try {
    switch (action) {
      case 'ekle': {
        const raw = params.get('urun') ?? params.get('ürün') ?? '';
        if (!raw.trim()) return { handled: false };
        const item = parseItemInput(raw);
        if (!item.name) return { handled: false };
        await addToList({ name: item.name }, item.qty, item.unit);
        scheduleSync();
        router.navigate('/list');
        await logEvent('info', 'Derin bağlantı: listeye eklendi', { raw });
        return { handled: true, message: `${item.name} listeye eklendi` };
      }

      case 'gorev':
      case 'görev': {
        const raw = params.get('metin') ?? params.get('text') ?? '';
        if (!raw.trim()) return { handled: false };
        const parsedTask = parseTaskInput(raw, new Date());
        if (!parsedTask.title) return { handled: false };
        await createTask({
          title: parsedTask.title,
          dueDate: parsedTask.date ?? null,
          dueTime: parsedTask.time ?? null,
          rrule: parsedTask.rule ?? null,
          reminderType: parsedTask.reminderType ?? 'none',
        });
        scheduleSync();
        router.navigate('/');
        await logEvent('info', 'Derin bağlantı: görev oluşturuldu', { raw });
        return { handled: true, message: `"${parsedTask.title}" eklendi` };
      }

      case 'liste':
        router.navigate('/list');
        return { handled: true };

      case 'bugun':
      case 'bugün':
        router.navigate('/');
        return { handled: true };

      case 'yerler':
        router.navigate('/places');
        return { handled: true };

      default:
        return { handled: false };
    }
  } catch (error) {
    await logEvent('error', 'Derin bağlantı işlenemedi', { url, error: String(error) });
    return { handled: false };
  }
}
