/** Item detail: name, category, unit, expiry date and purchase history. */
import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useToast } from '@/components/Toast';
import {
  Body,
  Button,
  Caption,
  Chip,
  Loading,
  Row,
  SectionHeader,
  Separator,
} from '@/components/ui';
import {
  addToList,
  deleteItem,
  getItem,
  listCategories,
  listPurchases,
  removeFromList,
  updateItem,
  type ItemFull,
} from '@/db/repos/items';
import { formatShortDate, parseDateKey, toDateKey } from '@/domain/format';
import { predict } from '@/domain/predictor';
import type { CategoryLike, Unit } from '@/domain/types';
import { UNITS } from '@/domain/types';
import { scheduleSync } from '@/services/sync';
import { MIN_TOUCH, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function ItemScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<ItemFull | null>(null);
  const [categories, setCategories] = useState<CategoryLike[]>([]);
  const [purchases, setPurchases] = useState<Date[]>([]);
  const [name, setName] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [nextItem, nextCategories, nextPurchases] = await Promise.all([
      getItem(id),
      listCategories(),
      listPurchases(id),
    ]);
    if (!nextItem) {
      router.back();
      return;
    }
    setItem(nextItem);
    setName(nextItem.name);
    setCategories(nextCategories);
    setPurchases(nextPurchases);
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const save = useCallback(
    async (patch: Parameters<typeof updateItem>[1]) => {
      if (!id) return;
      await updateItem(id, patch);
      scheduleSync();
      await load();
    },
    [id, load],
  );

  const remove = useCallback(() => {
    if (!item) return;
    Alert.alert('Ürünü sil', `"${item.name}" ve alım geçmişi silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void deleteItem(item.id).then(() => {
            scheduleSync();
            toast.show({ message: 'Ürün silindi' });
            router.back();
          });
        },
      },
    ]);
  }, [item, router, toast]);

  if (!item) return <Loading />;

  const prediction = predict(purchases, new Date());
  const expiry = item.expiryDate ? parseDateKey(item.expiryDate) : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={{ padding: space.lg, backgroundColor: colors.card }}>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={() => {
            if (name.trim() && name !== item.name) void save({ name });
          }}
          accessibilityLabel="Ürün adı"
          style={{ minHeight: MIN_TOUCH, color: colors.text, fontSize: 20, fontWeight: '600' }}
        />
      </View>

      <SectionHeader>Kategori</SectionHeader>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: space.sm,
          paddingHorizontal: space.lg,
        }}
      >
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            tone={item.categoryId === category.id ? 'accent' : 'default'}
            onPress={() => void save({ categoryId: category.id })}
          />
        ))}
      </View>
      {!item.categoryLocked ? (
        <Caption style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
          Bu kategori tahmin edildi. Değiştirirsen bir daha değiştirilmez.
        </Caption>
      ) : null}

      <SectionHeader>Birim</SectionHeader>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: space.sm,
          paddingHorizontal: space.lg,
        }}
      >
        {UNITS.map((unit: Unit) => (
          <Chip
            key={unit}
            label={unit}
            tone={item.unit === unit ? 'accent' : 'default'}
            onPress={() => void save({ unit })}
          />
        ))}
      </View>

      <SectionHeader>Dolap</SectionHeader>
      <Row
        title="Son kullanma tarihi"
        subtitle={expiry ? formatShortDate(expiry) : 'Yok'}
        icon="calendar.badge.clock"
        onPress={() => setShowDatePicker((v) => !v)}
        right={
          expiry ? (
            <Button
              title="Kaldır"
              variant="plain"
              onPress={() => void save({ expiryDate: null })}
            />
          ) : undefined
        }
      />
      {showDatePicker ? (
        <DateTimePicker
          value={expiry ?? new Date()}
          mode="date"
          display="inline"
          locale="tr-TR"
          accentColor={colors.accent}
          onChange={(_, selected) => {
            if (Platform.OS !== 'ios') setShowDatePicker(false);
            if (selected) void save({ expiryDate: toDateKey(selected) });
          }}
        />
      ) : null}

      <SectionHeader>Alım geçmişi</SectionHeader>
      {purchases.length === 0 ? (
        <Caption style={{ paddingHorizontal: space.lg }}>Henüz alım kaydı yok.</Caption>
      ) : (
        <View style={{ paddingHorizontal: space.lg, gap: space.xs }}>
          <Body muted>{purchases.length} alım kaydı</Body>
          {prediction ? (
            <Caption>
              Ortalama {Math.round(prediction.medianDays)} günde bir alınıyor
              {prediction.isDue ? ' · şu an bitmiş olabilir' : ''}
            </Caption>
          ) : (
            <Caption>Tahmin için en az 3 alım gerekiyor.</Caption>
          )}
          {purchases
            .slice()
            .sort((a, b) => b.getTime() - a.getTime())
            .slice(0, 8)
            .map((date, index) => (
              <Caption key={index}>{formatShortDate(date)}</Caption>
            ))}
        </View>
      )}

      <Separator />
      <View style={{ padding: space.lg, gap: space.md }}>
        {item.onList ? (
          <Button
            title="Listeden çıkar"
            variant="secondary"
            onPress={() => {
              void removeFromList(item.id).then(() => {
                scheduleSync();
                void load();
              });
            }}
          />
        ) : (
          <Button
            title="Listeye ekle"
            onPress={() => {
              void addToList({ id: item.id }, item.defaultQty).then(() => {
                scheduleSync();
                toast.show({ message: `${item.name} listeye eklendi` });
                void load();
              });
            }}
          />
        )}
        <Button title="Ürünü sil" variant="danger" onPress={remove} />
      </View>
    </ScrollView>
  );
}
