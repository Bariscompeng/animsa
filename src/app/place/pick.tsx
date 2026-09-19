/**
 * Map picker (§3.6).
 *
 * `expo-maps` AppleMaps exposes `onMapClick` but no long-press, so tapping the
 * map moves the pin (see docs/KARARLAR.md).
 *
 * The camera is deliberately NOT tied to the pin: feeding `cameraPosition` a
 * value that changes on every tap makes the map jump and reset its zoom on each
 * touch. It is driven only by explicit actions — first load, address search and
 * "use my location" — so panning and zooming stay under the user's control.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppleMaps } from 'expo-maps';
import * as Haptics from 'expo-haptics';

import { useToast } from '@/components/Toast';
import { Button, Icon, Screen } from '@/components/ui';
import { DEFAULT_RADIUS } from '@/domain/regions';
import type { PlaceType } from '@/domain/types';
import { geocode, getCoords } from '@/services/location';
import { ACCENT, MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const FALLBACK = { lat: 41.0082, lng: 28.9784 };

type Camera = { lat: number; lng: number; zoom: number; nonce: number };

export default function PickPlaceScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    id?: string;
    type?: string;
    radius?: string;
  }>();

  const initial = useMemo(
    () => ({
      lat: params.lat ? Number(params.lat) : FALLBACK.lat,
      lng: params.lng ? Number(params.lng) : FALLBACK.lng,
    }),
    [params.lat, params.lng],
  );

  /** The chosen point. Changes on every tap. */
  const [coords, setCoords] = useState(initial);
  /** Where the camera looks. Only explicit actions move it. */
  const [camera, setCamera] = useState<Camera>({ ...initial, zoom: 15, nonce: 0 });
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState(Boolean(params.lat));

  const radiusM = params.radius
    ? Number(params.radius)
    : DEFAULT_RADIUS[(params.type as PlaceType) ?? 'market'];

  /** Moves both the pin and the camera — used by search and my-location. */
  const jumpTo = useCallback((next: { lat: number; lng: number }, zoom = 16) => {
    setCoords(next);
    setCamera((prev) => ({ ...next, zoom, nonce: prev.nonce + 1 }));
    setTouched(true);
  }, []);

  useEffect(() => {
    if (params.lat && params.lng) return;
    void getCoords().then((current) => {
      if (current) jumpTo(current);
    });
  }, [params.lat, params.lng, jumpTo]);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const found = await geocode(query);
      if (found) jumpTo(found, 16);
      else toast.show({ message: 'Adres bulunamadı', tone: 'error' });
    } finally {
      setSearching(false);
    }
  }, [query, toast, jumpTo]);

  const goToMyLocation = useCallback(async () => {
    const current = await getCoords();
    if (current) jumpTo(current, 16);
    else toast.show({ message: 'Konum alınamadı', tone: 'error' });
  }, [toast, jumpTo]);

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
          placeholder="Adres veya yer adı ara"
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

      <View style={{ flex: 1 }}>
        <AppleMaps.View
          style={{ flex: 1 }}
          // `nonce` is part of the key so an explicit jump remounts the camera,
          // while a tap on the map leaves it exactly where the user left it.
          key={`camera-${camera.nonce}`}
          cameraPosition={{
            coordinates: { latitude: camera.lat, longitude: camera.lng },
            zoom: camera.zoom,
          }}
          properties={{
            isMyLocationEnabled: true,
            selectionEnabled: false,
          }}
          markers={[
            {
              id: 'picked',
              coordinates: { latitude: coords.lat, longitude: coords.lng },
              title: 'Seçilen yer',
              tintColor: ACCENT,
              systemImage: 'mappin',
            },
          ]}
          // The circle is the real feedback: it shows the area that will
          // actually trigger the reminder, not just where the pin sits.
          circles={[
            {
              id: 'radius',
              center: { latitude: coords.lat, longitude: coords.lng },
              radius: radiusM,
              color: isDark ? 'rgba(255,148,71,0.22)' : 'rgba(255,122,26,0.20)',
              lineColor: ACCENT,
              lineWidth: 2,
            },
          ]}
          onMapClick={(event) => {
            const lat = event.coordinates?.latitude;
            const lng = event.coordinates?.longitude;
            if (lat === undefined || lng === undefined) return;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCoords({ lat, lng });
            setTouched(true);
          }}
        />

        {!touched ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: space.md,
              left: space.lg,
              right: space.lg,
              backgroundColor: colors.cardElevated,
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <Icon name="hand.tap" color={colors.accent} size={18} />
            <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>
              Haritaya dokunarak yeri seç
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: space.lg, gap: space.md, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            backgroundColor: colors.accentSoft,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: space.md,
          }}
        >
          <Icon name="checkmark.circle.fill" color={colors.accent} size={20} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Yer seçildi</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 1 }}>
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} · {radiusM} m yarıçap
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            title="Konumum"
            variant="secondary"
            onPress={() => void goToMyLocation()}
            style={{ flex: 1 }}
          />
          <Button title="Bu noktayı seç" onPress={confirm} style={{ flex: 1.4 }} />
        </View>
      </View>
    </Screen>
  );
}
