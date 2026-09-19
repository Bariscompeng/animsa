/**
 * A settings row whose value is picked from a short list of choices, shown as
 * chips underneath. Used for the default lead time and the location cooldown.
 */
import { View } from 'react-native';

import { Chip, Row } from '@/components/ui';
import { space } from '@/theme/tokens';
import type { SFSymbol } from 'expo-symbols';

export function ChoiceRow<T extends string | number>({
  title,
  subtitle,
  icon,
  value,
  options,
  onChange,
}: {
  title: string;
  subtitle?: string;
  icon?: SFSymbol;
  value: T;
  options: { label: string; value: T }[];
  onChange: (next: T) => void;
}) {
  return (
    <View>
      <Row title={title} subtitle={subtitle} icon={icon} />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: space.md,
        }}
      >
        {options.map((option) => (
          <Chip
            key={String(option.value)}
            label={option.label}
            tone={option.value === value ? 'accent' : 'default'}
            onPress={() => onChange(option.value)}
            accessibilityLabel={`${title}: ${option.label}`}
          />
        ))}
      </View>
    </View>
  );
}
