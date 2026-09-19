/**
 * "Bitmek üzere" card (§3.8). Appears on both Today and Liste when the
 * predictor thinks something is running out.
 */
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Button, Card, Caption, Icon } from '@/components/ui';
import { addToList, dismissSuggestion } from '@/db/repos/items';
import { dueSuggestions, type Suggestion } from '@/services/predictions';
import { scheduleSync } from '@/services/sync';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function SuggestionCard({ onChanged }: { onChanged?: () => void }) {
  const { colors } = useTheme();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const load = useCallback(async () => {
    setSuggestions(await dueSuggestions());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const add = useCallback(
    async (suggestion: Suggestion) => {
      await addToList({ id: suggestion.item.id }, suggestion.item.defaultQty);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scheduleSync();
      await load();
      onChanged?.();
    },
    [load, onChanged],
  );

  const ignore = useCallback(
    async (suggestion: Suggestion) => {
      await dismissSuggestion(suggestion.item.id);
      await load();
    },
    [load],
  );

  if (suggestions.length === 0) return null;

  return (
    <Card tone="accent">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name="sparkles" color={colors.accent} size={18} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
          Bitmek üzere olabilir
        </Text>
      </View>

      {suggestions.slice(0, 4).map((suggestion) => (
        <View
          key={suggestion.item.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: space.md,
            gap: space.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>{suggestion.item.name}</Text>
            <Caption>
              Ortalama {Math.round(suggestion.prediction.medianDays)} günde bir alınıyor
            </Caption>
          </View>
          <Button title="Ekle" variant="plain" onPress={() => void add(suggestion)} />
          <Button title="Yoksay" variant="plain" onPress={() => void ignore(suggestion)} />
        </View>
      ))}
    </Card>
  );
}
