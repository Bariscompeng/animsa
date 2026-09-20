/**
 * The "Hızlı Erişim" block: three tappable tiles that jump straight to a
 * filtered view of the task list, each with its own hue so the eye can learn
 * them by colour rather than by reading.
 */
import { Pressable, ScrollView, Text, View } from 'react-native';

import { IconBadge, Panel } from '@/components/design';
import { Icon } from '@/components/ui';
import { hues, radius, space, type, type Hue } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { SFSymbol } from 'expo-symbols';

export type QuickAccessTile = {
  key: string;
  icon: SFSymbol;
  hue: Hue;
  title: string;
  count: number;
  onPress: () => void;
};

export function QuickAccess({ tiles, onEdit }: { tiles: QuickAccessTile[]; onEdit?: () => void }) {
  const { colors } = useTheme();
  if (tiles.length === 0) return null;

  return (
    <Panel style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.xs,
          paddingBottom: space.md,
        }}
      >
        <Icon name="bolt.fill" size={16} color={hues.amber} />
        <Text
          style={{
            flex: 1,
            color: colors.text,
            fontSize: type.headline.size,
            fontWeight: type.headline.weight,
          }}
        >
          Hızlı Erişim
        </Text>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel="Hızlı erişimi düzenle"
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: type.caption.size }}>
              Düzenle
            </Text>
            <Icon name="chevron.right" size={11} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xs }}
      >
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            onPress={tile.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${tile.title}, ${tile.count} görev`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              minWidth: 168,
              paddingVertical: space.md,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.cardElevated,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <IconBadge icon={tile.icon} hue={tile.hue} size={36} />
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}
              >
                {tile.title}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: type.caption.size }}>
                {tile.count} görev
              </Text>
            </View>
            <Icon name="chevron.right" size={12} color={colors.textTertiary} />
          </Pressable>
        ))}
      </ScrollView>
    </Panel>
  );
}
