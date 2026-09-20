/**
 * "Yerler" — saved places and nearby discoveries (§3.6).
 *
 * Without "Always" location permission region monitoring cannot run at all, so
 * the screen leads with an explanation rather than pretending to work.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { HeroHeader } from '@/components/design';
import { useToast } from '@/components/Toast';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  EmptyState,
  Icon,
  Row,
  Screen,
  SectionHeader,
  Separator,
} from '@/components/ui';
import {
  createPlace,
  deletePlace,
  hideOsmPlace,
  listPlaces,
  type PlaceFull,
} from '@/db/repos/places';
import { getSetting } from '@/db/repos/settings';
import { distanceMeters, type Coords } from '@/domain/regions';
import type { PlaceType } from '@/domain/types';
import { getCoords, getPermissions, refreshRegions } from '@/services/location';
import { discoverNearby, type OsmPlace } from '@/services/osm';
import { openSystemSettings } from '@/services/permissions';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TYPE_LABEL: Record<PlaceType, string> = {
  home: 'Ev',
  work: 'İş',
  market: 'Market',
  pharmacy: 'Eczane',
  bakery: 'Fırın',
  hardware: 'Hırdavat',
  other: 'Diğer',
};

const TYPE_ICON: Record<PlaceType, Parameters<typeof Icon>[0]['name']> = {
  home: 'house',
  work: 'briefcase',
  market: 'cart',
  pharmacy: 'cross.case',
  bakery: 'birthday.cake',
  hardware: 'wrench.and.screwdriver',
  other: 'mappin',
};

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1).replace('.', ',')} km`;
}

export default function PlacesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [places, setPlaces] = useState<PlaceFull[]>([]);
  const [nearby, setNearby] = useState<OsmPlace[]>([]);
  const [here, setHere] = useState<Coords | null>(null);
  const [canMonitor, setCanMonitor] = useState(true);
  const [discovering, setDiscovering] = useState(false);

  const reload = useCallback(async () => {
    const [nextPlaces, permissions] = await Promise.all([listPlaces(), getPermissions()]);
    setPlaces(nextPlaces);
    setCanMonitor(permissions.canMonitor);
    if (permissions.foreground === 'granted') {
      setHere(await getCoords());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const discover = useCallback(async () => {
    const coords = here ?? (await getCoords());
    if (!coords) {
      toast.show({ message: 'Konum alınamadı', tone: 'error' });
      return;
    }
    const autoDiscover = await getSetting('autoDiscoverPlaces');
    if (!autoDiscover) {
      toast.show({ message: "Otomatik keşif Ayarlar'dan kapatılmış" });
      return;
    }
    setDiscovering(true);
    try {
      const found = await discoverNearby(coords.lat, coords.lng);
      const savedOsmIds = new Set(places.map((p) => p.osmId).filter(Boolean));
      setNearby(found.filter((p) => !savedOsmIds.has(p.osmId)).slice(0, 25));
    } finally {
      setDiscovering(false);
    }
  }, [here, places, toast]);

  const sections = useMemo(() => {
    const sorted = [...places].sort((a, b) => {
      if (here) {
        return (
          distanceMeters(here, { lat: a.lat, lng: a.lng }) -
          distanceMeters(here, { lat: b.lat, lng: b.lng })
        );
      }
      return a.name.localeCompare(b.name, 'tr-TR');
    });
    return [{ title: 'Kayıtlı yerler', data: sorted }];
  }, [places, here]);

  const remove = useCallback(
    (place: PlaceFull) => {
      Alert.alert('Yeri sil', `"${place.name}" silinsin mi?`, [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void deletePlace(place.id).then(() => {
              void refreshRegions();
              void reload();
            });
          },
        },
      ]);
    },
    [reload],
  );

  const saveOsmPlace = useCallback(
    async (place: OsmPlace) => {
      await createPlace({
        name: place.name,
        type: place.type,
        lat: place.lat,
        lng: place.lng,
        source: 'osm',
        osmId: place.osmId,
        brand: place.brand,
      });
      setNearby((prev) => prev.filter((p) => p.osmId !== place.osmId));
      toast.show({ message: `${place.name} kaydedildi` });
      void refreshRegions();
      await reload();
    },
    [reload, toast],
  );

  const hide = useCallback(async (place: OsmPlace) => {
    await hideOsmPlace(place.osmId);
    setNearby((prev) => prev.filter((p) => p.osmId !== place.osmId));
  }, []);

  return (
    <Screen>
      <HeroHeader title="Yerler" subtitle="Doğru yerde hatırlat 📍" />
      <SectionList
        sections={sections}
        keyExtractor={(place) => place.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            {!canMonitor ? (
              <Card tone="warning">
                <Text style={{ color: colors.warning, fontSize: 15, fontWeight: '600' }}>
                  {'Konum izni "Her Zaman" değil'}
                </Text>
                <Caption style={{ marginTop: space.sm, lineHeight: 20 }}>
                  {
                    'Markete yaklaştığında veya evden çıktığında uygulama kapalıyken de hatırlatabilmek için "Her Zaman" konum izni gerekiyor. Bu izin olmadan yer hatırlatmaları çalışmaz.'
                  }
                </Caption>
                <Button
                  title="Ayarları aç"
                  variant="secondary"
                  onPress={() => void openSystemSettings()}
                  style={{ marginTop: space.md }}
                />
              </Card>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                gap: space.sm,
                paddingHorizontal: space.lg,
                paddingTop: space.md,
              }}
            >
              <Button
                title="Yer ekle"
                onPress={() => router.navigate('/place/new')}
                style={{ flex: 1 }}
              />
              <Button
                title={discovering ? 'Aranıyor…' : 'Yakındakileri bul'}
                variant="secondary"
                loading={discovering}
                onPress={() => void discover()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          places.length === 0 ? (
            <EmptyState
              icon="mappin.and.ellipse"
              title="Henüz yer yok"
              description="Ev ve marketini ekle; listende ürün varken oraya yaklaştığında hatırlatayım."
              action={{ label: 'Yer ekle', onPress: () => router.navigate('/place/new') }}
            />
          ) : null
        }
        renderSectionHeader={({ section }) =>
          section.data.length > 0 ? <SectionHeader>{section.title}</SectionHeader> : null
        }
        renderItem={({ item }) => (
          <Row
            title={item.name}
            subtitle={`${TYPE_LABEL[item.type]} · ${item.radiusM} m${
              here
                ? ` · ${formatDistance(distanceMeters(here, { lat: item.lat, lng: item.lng }))}`
                : ''
            }${item.enabled ? '' : ' · kapalı'}`}
            icon={TYPE_ICON[item.type]}
            onPress={() => router.navigate(`/place/${item.id}`)}
            right={<Button title="Sil" variant="plain" onPress={() => remove(item)} />}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListFooterComponent={
          nearby.length > 0 ? (
            <View>
              <SectionHeader>Yakındakiler (OpenStreetMap)</SectionHeader>
              {nearby.map((place) => (
                <View key={place.osmId}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      paddingHorizontal: space.lg,
                      paddingVertical: space.md,
                      backgroundColor: colors.card,
                    }}
                  >
                    <Icon name={TYPE_ICON[place.type]} color={colors.textTertiary} />
                    <View style={{ flex: 1 }}>
                      <Body muted>{place.name}</Body>
                      <Caption>
                        {TYPE_LABEL[place.type]}
                        {here
                          ? ` · ${formatDistance(
                              distanceMeters(here, { lat: place.lat, lng: place.lng }),
                            )}`
                          : ''}
                      </Caption>
                    </View>
                    <Button
                      title="Kaydet"
                      variant="plain"
                      onPress={() => void saveOsmPlace(place)}
                    />
                    <Button title="Gizle" variant="plain" onPress={() => void hide(place)} />
                  </View>
                  <Separator />
                </View>
              ))}
              <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
                <Chip label="Veri: OpenStreetMap katkıcıları" />
              </View>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
