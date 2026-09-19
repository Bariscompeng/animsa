/** Edit an existing place. */
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PlaceForm, type PlaceFormValue } from '@/components/PlaceForm';
import { useToast } from '@/components/Toast';
import { Loading } from '@/components/ui';
import { deletePlace, getPlace, updatePlace } from '@/db/repos/places';
import { refreshRegions } from '@/services/location';

export default function EditPlaceScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string; lat?: string; lng?: string }>();

  const [value, setValue] = useState<PlaceFormValue | null>(null);

  useEffect(() => {
    if (!params.id) return;
    void getPlace(params.id).then((place) => {
      if (!place) {
        router.back();
        return;
      }
      setValue({
        name: place.name,
        type: place.type,
        lat: params.lat ? Number(params.lat) : place.lat,
        lng: params.lng ? Number(params.lng) : place.lng,
        radiusM: place.radiusM,
        enabled: place.enabled,
      });
    });
  }, [params.id, params.lat, params.lng, router]);

  const submit = useCallback(async () => {
    if (!params.id || !value) return;
    await updatePlace(params.id, {
      name: value.name,
      type: value.type,
      lat: value.lat,
      lng: value.lng,
      radiusM: value.radiusM,
      enabled: value.enabled,
    });
    void refreshRegions();
    toast.show({ message: 'Yer güncellendi' });
    router.back();
  }, [params.id, router, toast, value]);

  const remove = useCallback(() => {
    if (!params.id || !value) return;
    Alert.alert('Yeri sil', `"${value.name}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void deletePlace(params.id).then(() => {
            void refreshRegions();
            toast.show({ message: 'Yer silindi' });
            router.back();
          });
        },
      },
    ]);
  }, [params.id, router, toast, value]);

  if (!value) return <Loading />;

  return (
    <PlaceForm
      value={value}
      onChange={setValue}
      onSubmit={() => void submit()}
      onDelete={remove}
      submitLabel="Güncelle"
    />
  );
}
