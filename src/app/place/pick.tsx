/**
 * Map picker (§3.6).
 *
 * `expo-maps` AppleMaps exposes `onMapClick` but no long-press, so tapping the
 * map moves the pin (see docs/KARARLAR.md). Address search and "use my
 * location" cover the other two ways to place a pin.
 */
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppleMaps } from 'expo-maps';

import { useToast } from '@/components/Toast';
import { Button, Caption, Screen } from '@/components/ui';
import { geocode, getCoords } from '@/services/location';
import { ACCENT, MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const FALLBACK = { lat: 41.0082, lng: 28.9784 };

export default function PickPlaceScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ lat?: string; lng?: string; id?: string }>();

  const [coords, setCoords] = useState({
    lat: params.lat ? Number(params.lat) : FALLBACK.lat,
    lng: params.lng ? Number(params.lng) : FALLBACK.lng,
  });
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (params.lat && params.lng) return;
    void getCoords().then((current) => {
      if (current) setCoords(current);
    });
  }, [params.lat, params.lng]);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const found = await geocode(query);
      if (found) setCoords(found);
      else toast.show({ message: 'Adres bulunamadı', tone: 'error' });
    } finally {
      setSearching(false);
    }
  }, [query, toast]);

  const goToMyLocation = useCallback(async () => {
    const current = await getCoords();
    if (current) setCoords(current);
    else toast.show({ message: 'Konum alınamadı', tone: 'error' });
  }, [toast]);

  /** Hands the chosen point back to whichever form opened this screen. */
  const confirm = useCallback(() => {
    router.navigate({
      pathname: params.id ? `/place/${params.id}` : '/place/new',
      params: { lat: String(coords.lat), lng: String(coords.lng) },
    });
  }, [coords, params.id, router]);

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          padding: space.lg,
          backgroundColor: colors.background,
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          returnKeyType="search"
          placeholder="Adres ara"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Adres ara"
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
        <Button title="Ara" variant="secondary" loading={searching} onPress={() => void search()} />
      </View>

      <AppleMaps.View
        style={{ flex: 1 }}
        cameraPosition={{
          coordinates: { latitude: coords.lat, longitude: coords.lng },
          zoom: 15,
        }}
        markers={[
          {
            coordinates: { latitude: coords.lat, longitude: coords.lng },
            title: 'Seçilen yer',
            tintColor: ACCENT,
          },
        ]}
        onMapClick={(event) => {
          if (event.coordinates?.latitude === undefined) return;
          setCoords({
            lat: event.coordinates.latitude,
            lng: event.coordinates.longitude ?? coords.lng,
          });
        }}
      />

      <View style={{ padding: space.lg, gap: space.sm, backgroundColor: colors.background }}>
        <Caption>
          Haritaya dokunarak iğneyi taşı · {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </Caption>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            title="Konumumu kullan"
            variant="secondary"
            onPress={() => void goToMyLocation()}
            style={{ flex: 1 }}
          />
          <Button title="Bu noktayı seç" onPress={confirm} style={{ flex: 1 }} />
        </View>
      </View>
    </Screen>
  );
}
