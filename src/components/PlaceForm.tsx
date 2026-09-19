/** Shared place editor: name, type, radius, coordinates. */
import { useCallback } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Caption, Chip, Row, SectionHeader, Separator, SwitchRow } from '@/components/ui';
import { DEFAULT_RADIUS, MAX_PLACE_RADIUS_M, MIN_PLACE_RADIUS_M } from '@/domain/regions';
import type { PlaceType } from '@/domain/types';
import { MIN_TOUCH, radius as r, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type PlaceFormValue = {
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  radiusM: number;
  enabled: boolean;
};

const TYPES: { label: string; value: PlaceType }[] = [
  { label: 'Ev', value: 'home' },
  { label: 'İş', value: 'work' },
  { label: 'Market', value: 'market' },
  { label: 'Eczane', value: 'pharmacy' },
  { label: 'Fırın', value: 'bakery' },
  { label: 'Hırdavat', value: 'hardware' },
  { label: 'Diğer', value: 'other' },
];

const RADIUS_OPTIONS = [100, 120, 150, 200, 300, 500, 1000];

export function PlaceForm({
  value,
  onChange,
  onSubmit,
  onDelete,
  submitLabel,
}: {
  value: PlaceFormValue;
  onChange: (next: PlaceFormValue) => void;
  onSubmit: () => void;
  onDelete?: () => void;
  submitLabel: string;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  const set = useCallback(
    <K extends keyof PlaceFormValue>(key: K, next: PlaceFormValue[K]) => {
      onChange({ ...value, [key]: next });
    },
    [onChange, value],
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={{ padding: space.lg, backgroundColor: colors.card }}>
        <TextInput
          value={value.name}
          onChangeText={(t) => set('name', t)}
          placeholder="Yerin adı"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Yer adı"
          autoFocus={!value.name}
          style={{ minHeight: MIN_TOUCH, color: colors.text, fontSize: 20, fontWeight: '600' }}
        />
      </View>

      <SectionHeader>Tür</SectionHeader>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: space.sm,
          paddingHorizontal: space.lg,
        }}
      >
        {TYPES.map((type) => (
          <Chip
            key={type.value}
            label={type.label}
            tone={value.type === type.value ? 'accent' : 'default'}
            onPress={() => {
              // Switching type resets the radius to that type's sensible default.
              onChange({ ...value, type: type.value, radiusM: DEFAULT_RADIUS[type.value] });
            }}
          />
        ))}
      </View>

      <SectionHeader>Yarıçap</SectionHeader>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: space.sm,
          paddingHorizontal: space.lg,
        }}
      >
        {RADIUS_OPTIONS.map((metres) => (
          <Chip
            key={metres}
            label={`${metres} m`}
            tone={value.radiusM === metres ? 'accent' : 'default'}
            onPress={() => set('radiusM', metres)}
          />
        ))}
      </View>
      <Caption style={{ paddingHorizontal: space.lg, paddingTop: space.sm, lineHeight: 19 }}>
        iOS {MIN_PLACE_RADIUS_M} m altındaki bölgeleri güvenilir şekilde algılamıyor; en fazla{' '}
        {MAX_PLACE_RADIUS_M} m kullanılabilir.
      </Caption>

      <SectionHeader>Konum</SectionHeader>
      <Row
        title="Haritada seç"
        subtitle={`${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}
        icon="map"
        onPress={() =>
          router.navigate({
            pathname: '/place/pick',
            params: {
              lat: String(value.lat),
              lng: String(value.lng),
              // The picker draws the real trigger area, so it needs both.
              type: value.type,
              radius: String(value.radiusM),
            },
          })
        }
      />
      <Separator />
      <SwitchRow
        title="Etkin"
        subtitle="Kapalıyken bu yer izlenmez"
        icon="power"
        value={value.enabled}
        onValueChange={(v) => set('enabled', v)}
      />

      <View style={{ padding: space.lg, gap: space.md }}>
        <Button title={submitLabel} onPress={onSubmit} disabled={!value.name.trim()} />
        {onDelete ? <Button title="Yeri sil" variant="danger" onPress={onDelete} /> : null}
      </View>

      {!value.name.trim() ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            paddingHorizontal: space.lg,
            paddingBottom: space.lg,
          }}
        >
          Kaydetmek için bir ad yaz.
        </Text>
      ) : null}

      <View style={{ height: r.sm }} />
    </ScrollView>
  );
}
