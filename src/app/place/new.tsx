/**
 * New place. Starts at the current position when one is available, so the
 * common case ("save where I am") is a single tap.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PlaceForm, type PlaceFormValue } from '@/components/PlaceForm';
import { useToast } from '@/components/Toast';
import { createPlace } from '@/db/repos/places';
import { DEFAULT_RADIUS } from '@/domain/regions';
import { getCoords, refreshRegions } from '@/services/location';

/** Istanbul city centre — only used until a real fix arrives. */
const FALLBACK = { lat: 41.0082, lng: 28.9784 };

export default function NewPlaceScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const [value, setValue] = useState<PlaceFormValue>({
    name: '',
    type: 'market',
    lat: params.lat ? Number(params.lat) : FALLBACK.lat,
    lng: params.lng ? Number(params.lng) : FALLBACK.lng,
    radiusM: DEFAULT_RADIUS.market,
    enabled: true,
  });

  const { lat: latParam, lng: lngParam } = params;

  useEffect(() => {
    const resolve =
      latParam && lngParam
        ? Promise.resolve({ lat: Number(latParam), lng: Number(lngParam) })
        : getCoords();
    void resolve.then((coords) => {
      if (coords) setValue((prev) => ({ ...prev, lat: coords.lat, lng: coords.lng }));
    });
  }, [latParam, lngParam]);

  const submit = useCallback(async () => {
    await createPlace({
      name: value.name,
      type: value.type,
      lat: value.lat,
      lng: value.lng,
      radiusM: value.radiusM,
    });
    void refreshRegions();
    toast.show({ message: `${value.name} kaydedildi` });
    router.back();
  }, [router, toast, value]);

  return (
    <PlaceForm
      value={value}
      onChange={setValue}
      onSubmit={() => void submit()}
      submitLabel="Kaydet"
    />
  );
}
