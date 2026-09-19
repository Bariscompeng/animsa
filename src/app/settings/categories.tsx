/**
 * Aisle order (§3.4). The list groups by category in exactly this order, so
 * the user can make the app match the shop they actually walk through.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';

import { Caption, Icon, IconButton, Screen, SectionHeader, Separator } from '@/components/ui';
import { listCategories, reorderCategories } from '@/db/repos/items';
import type { CategoryLike } from '@/domain/types';
import { MIN_TOUCH, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function CategoriesScreen() {
  const { colors } = useTheme();
  const [categories, setCategories] = useState<CategoryLike[]>([]);

  useEffect(() => {
    void listCategories().then(setCategories);
  }, []);

  const move = useCallback((index: number, delta: number) => {
    setCategories((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const [moved] = next.splice(index, 1);
      if (!moved) return prev;
      next.splice(target, 0, moved);
      void reorderCategories(next.map((c) => c.id));
      return next;
    });
  }, []);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Kategori sırası' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <SectionHeader>Reyon sırası</SectionHeader>
        <Caption style={{ paddingHorizontal: space.lg, paddingBottom: space.md, lineHeight: 20 }}>
          Alınacaklar listesi bu sırayla gruplanır. Markette gezdiğin sıraya göre düzenle.
        </Caption>

        {categories.map((category, index) => (
          <View key={category.id}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                minHeight: MIN_TOUCH,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                backgroundColor: colors.card,
              }}
            >
              <Icon name={category.sfSymbol as never} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Caption style={{ color: colors.text, fontSize: 17 }}>{category.name}</Caption>
                <Caption>
                  {category.placeTypes.length > 0
                    ? category.placeTypes
                        .map((t) =>
                          t === 'market'
                            ? 'Market'
                            : t === 'pharmacy'
                              ? 'Eczane'
                              : t === 'bakery'
                                ? 'Fırın'
                                : t === 'hardware'
                                  ? 'Hırdavat'
                                  : t,
                        )
                        .join(', ')
                    : 'Konum eşleşmesi yok'}
                </Caption>
              </View>
              <IconButton
                name="chevron.up"
                size={18}
                label={`${category.name} yukarı taşı`}
                disabled={index === 0}
                onPress={() => move(index, -1)}
              />
              <IconButton
                name="chevron.down"
                size={18}
                label={`${category.name} aşağı taşı`}
                disabled={index === categories.length - 1}
                onPress={() => move(index, 1)}
              />
            </View>
            <Separator />
          </View>
        ))}

        <View style={{ height: space.xxl }} />
      </ScrollView>
    </Screen>
  );
}
