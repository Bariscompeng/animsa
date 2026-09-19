/**
 * "Liste" — household needs (§3.4).
 *
 * Three segments over the same catalogue: what to buy now, everything the
 * house knows about, and what is sitting in the cupboard with an expiry date.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';

import { SuggestionCard } from '@/components/SuggestionCard';
import { useToast } from '@/components/Toast';
import {
  Body,
  Button,
  Caption,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Separator,
} from '@/components/ui';
import {
  addToList,
  clearList,
  listCategories,
  listItems,
  markPurchased,
  removeFromList,
  type ItemFull,
} from '@/db/repos/items';
import { formatQty, formatShortDate, parseDateKey, toDateKey } from '@/domain/format';
import { matchesPrefix } from '@/domain/normalize';
import { parseItemInput } from '@/domain/nlp/parseItemInput';
import type { CategoryLike } from '@/domain/types';
import { useKeyboardHeight } from '@/components/useKeyboardHeight';
import { scheduleSync } from '@/services/sync';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Segment = 'list' | 'all' | 'pantry';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'list', label: 'Alınacaklar' },
  { key: 'all', label: 'Tüm Ürünler' },
  { key: 'pantry', label: 'Dolap' },
];

export default function ListScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const keyboardHeight = useKeyboardHeight();
  const [segment, setSegment] = useState<Segment>('list');
  const [items, setItems] = useState<ItemFull[]>([]);
  const [categories, setCategories] = useState<CategoryLike[]>([]);
  const [query, setQuery] = useState('');
  /** Today's date key, refreshed on focus so "expired" stays accurate. */
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  /** Items in their 5-second "undo" window, hidden but not yet committed. */
  const [pendingPurchase, setPendingPurchase] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const [nextItems, nextCategories] = await Promise.all([listItems(), listCategories()]);
    setItems(nextItems);
    setCategories(nextCategories);
    setTodayKey(toDateKey(new Date()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const onList = useMemo(
    () => items.filter((i) => i.onList && !pendingPurchase.has(i.id)),
    [items, pendingPurchase],
  );

  const suggestions = useMemo(() => {
    if (query.trim().length === 0) return [];
    return items.filter((i) => !i.onList && matchesPrefix(i.name, query)).slice(0, 5);
  }, [items, query]);

  const sections = useMemo(() => {
    if (segment === 'list') {
      // Grouped by category, in the user's own aisle order.
      const groups = new Map<string, ItemFull[]>();
      for (const item of onList) {
        const list = groups.get(item.categoryId) ?? [];
        list.push(item);
        groups.set(item.categoryId, list);
      }
      return categories
        .filter((c) => groups.has(c.id))
        .map((c) => ({ title: c.name, data: groups.get(c.id)! }));
    }

    if (segment === 'pantry') {
      const withExpiry = items
        .filter((i) => i.expiryDate)
        .sort((a, b) => (a.expiryDate! < b.expiryDate! ? -1 : 1));
      return withExpiry.length > 0
        ? [{ title: 'Son kullanma tarihine göre', data: withExpiry }]
        : [];
    }

    const filtered = query.trim() ? items.filter((i) => matchesPrefix(i.name, query)) : items;
    return filtered.length > 0 ? [{ title: `${filtered.length} ürün`, data: filtered }] : [];
  }, [segment, onList, items, categories, query]);

  // ----------------------------------------------------------------- actions

  const add = useCallback(
    async (raw: string) => {
      const parsed = parseItemInput(raw);
      if (!parsed.name) return;
      await addToList({ name: parsed.name }, parsed.qty, parsed.unit);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuery('');
      scheduleSync();
      await reload();
    },
    [reload],
  );

  const addExisting = useCallback(
    async (item: ItemFull) => {
      await addToList({ id: item.id }, item.defaultQty);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuery('');
      scheduleSync();
      await reload();
    },
    [reload],
  );

  /**
   * Marking an item bought is optimistic: it disappears at once and the
   * purchase is committed five seconds later unless the user undoes it.
   */
  const buy = useCallback(
    (item: ItemFull) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPendingPurchase((prev) => new Set(prev).add(item.id));

      let undone = false;
      const commit = setTimeout(() => {
        if (undone) return;
        void markPurchased(item.id, item.listQty).then(() => {
          setPendingPurchase((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
          scheduleSync();
          void reload();
        });
      }, 5000);

      toast.show({
        message: `${item.name} alındı`,
        duration: 5000,
        action: {
          label: 'Geri al',
          onPress: () => {
            undone = true;
            clearTimeout(commit);
            setPendingPurchase((prev) => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
            });
          },
        },
      });
    },
    [reload, toast],
  );

  const buyAll = useCallback(() => {
    if (onList.length === 0) return;
    Alert.alert('Tümünü alındı işaretle', `${onList.length} ürün alındı sayılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İşaretle',
        onPress: () => {
          void clearList().then(() => {
            toast.show({ message: 'Liste temizlendi' });
            scheduleSync();
            void reload();
          });
        },
      },
    ]);
  }, [onList.length, reload, toast]);

  const shareList = useCallback(async () => {
    if (onList.length === 0) return;
    const lines = onList.map((item) => {
      const qty = item.listQty ? ` (${formatQty(item.listQty, item.unit)})` : '';
      return `• ${item.name}${qty}`;
    });
    const text = `Alışveriş listesi\n\n${lines.join('\n')}`;

    try {
      const file = new File(Paths.cache as Directory, 'alisveris-listesi.txt');
      if (file.exists) file.delete();
      file.create();
      file.write(text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text' });
      }
    } catch {
      toast.show({ message: 'Liste paylaşılamadı', tone: 'error' });
    }
  }, [onList, toast]);

  // ------------------------------------------------------------------ render

  const renderItem = (item: ItemFull) => {
    if (segment === 'list') {
      return (
        <Pressable
          onPress={() => buy(item)}
          onLongPress={() => router.navigate(`/item/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, alındı olarak işaretle`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            minHeight: MIN_TOUCH + 4,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            backgroundColor: pressed ? colors.groupedBackground : colors.card,
          })}
        >
          <Icon name="circle" size={22} color={colors.separator} />
          <View style={{ flex: 1 }}>
            <Body>{item.name}</Body>
            {item.listQty ? <Caption>{formatQty(item.listQty, item.unit)}</Caption> : null}
          </View>
          <IconButton
            name="xmark.circle"
            size={20}
            label={`${item.name} listeden çıkar`}
            onPress={() => {
              void removeFromList(item.id).then(() => {
                scheduleSync();
                void reload();
              });
            }}
          />
        </Pressable>
      );
    }

    if (segment === 'pantry') {
      const expiry = item.expiryDate ? parseDateKey(item.expiryDate) : null;
      const expired = item.expiryDate ? item.expiryDate < todayKey : false;
      return (
        <Pressable
          onPress={() => router.navigate(`/item/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, son kullanma ${expiry ? formatShortDate(expiry) : ''}`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: MIN_TOUCH,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            backgroundColor: pressed ? colors.groupedBackground : colors.card,
          })}
        >
          <View style={{ flex: 1 }}>
            <Body>{item.name}</Body>
            <Text style={{ color: expired ? colors.danger : colors.textSecondary, fontSize: 14 }}>
              {expiry ? `SKT ${formatShortDate(expiry)}` : ''}
              {expired ? ' · geçmiş' : ''}
            </Text>
          </View>
          <Icon name="chevron.right" size={14} />
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={() => router.navigate(`/item/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: MIN_TOUCH,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          backgroundColor: pressed ? colors.groupedBackground : colors.card,
        })}
      >
        <View style={{ flex: 1 }}>
          <Body>{item.name}</Body>
          <Caption>{categoryById.get(item.categoryId)?.name ?? 'Diğer'}</Caption>
        </View>
        {item.onList ? (
          <Chip label="Listede" tone="accent" />
        ) : (
          <Button title="Listeye ekle" variant="plain" onPress={() => void addExisting(item)} />
        )}
      </Pressable>
    );
  };

  const emptyState = () => {
    if (segment === 'list') {
      return (
        <EmptyState
          icon="cart"
          title="Alınacak bir şey yok"
          description={'Aşağıya yazarak ekle:\n"2 kg domates"'}
        />
      );
    }
    if (segment === 'pantry') {
      return (
        <EmptyState
          icon="calendar.badge.clock"
          title="Dolapta takip edilen ürün yok"
          description="Bir ürüne son kullanma tarihi eklersen burada görünür ve tarihinden 2 gün önce hatırlatılır."
        />
      );
    }
    return (
      <EmptyState
        icon="basket"
        title="Katalog boş"
        description="Listeye eklediğin her ürün burada birikir ve alım alışkanlığın öğrenilir."
      />
    );
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          gap: space.xs,
          margin: space.lg,
          padding: space.xs,
          borderRadius: radius.md,
          backgroundColor: colors.groupedBackground,
        }}
      >
        {SEGMENTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSegment(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: segment === s.key }}
            accessibilityLabel={s.label}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH - 6,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              backgroundColor: segment === s.key ? colors.card : 'transparent',
              shadowColor: '#000',
              shadowOpacity: segment === s.key ? 0.16 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
            }}
          >
            <Text
              style={{
                color: segment === s.key ? colors.accent : colors.textSecondary,
                fontSize: 15,
                fontWeight: segment === s.key ? '700' : '500',
              }}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          segment === 'list' ? (
            <View>
              <SuggestionCard onChanged={() => void reload()} />
              {onList.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg }}>
                  <Button
                    title="Tümünü alındı işaretle"
                    variant="secondary"
                    onPress={buyAll}
                    style={{ flex: 1 }}
                  />
                  <Button title="Paylaş" variant="secondary" onPress={() => void shareList()} />
                </View>
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={emptyState()}
        renderSectionHeader={({ section }) => <SectionHeader>{section.title}</SectionHeader>}
        renderItem={({ item }) => renderItem(item)}
        ItemSeparatorComponent={Separator}
      />

      {segment !== 'pantry' ? (
        <View
          style={{
            // Lift clear of the keyboard, exactly as the Today quick-add does.
            marginBottom: keyboardHeight,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
            backgroundColor: colors.background,
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: space.md,
          }}
        >
          {suggestions.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: space.sm,
                marginBottom: space.sm,
              }}
            >
              {suggestions.map((item) => (
                <Chip
                  key={item.id}
                  label={item.name}
                  tone="accent"
                  onPress={() => void addExisting(item)}
                  accessibilityLabel={`${item.name} listeye ekle`}
                />
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void add(query)}
              returnKeyType="done"
              placeholder="2 kg domates"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Listeye ürün ekle"
              style={{
                flex: 1,
                minHeight: MIN_TOUCH,
                paddingHorizontal: space.md,
                borderRadius: radius.md,
                backgroundColor: colors.groupedBackground,
                color: colors.text,
                fontSize: 17,
              }}
            />
            <IconButton
              name="barcode.viewfinder"
              size={26}
              color={colors.accent}
              label="Barkod tara"
              onPress={() => router.navigate('/scan')}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
