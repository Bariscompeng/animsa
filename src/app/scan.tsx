/**
 * Barcode scanning (§3.4).
 *
 * Known barcode → straight onto the list. Unknown → Open Food Facts for a
 * name, which the user confirms or corrects. Offline → type the name.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';

import { useToast } from '@/components/Toast';
import { Button, Caption, EmptyState, Screen } from '@/components/ui';
import { addToList, createItem, findByBarcode, updateItem } from '@/db/repos/items';
import { logEvent } from '@/db/repos/misc';
import { lookupBarcode } from '@/services/openFoodFacts';
import { scheduleSync } from '@/services/sync';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Stage =
  | { kind: 'scanning' }
  | { kind: 'looking-up'; barcode: string }
  | { kind: 'confirm'; barcode: string; name: string; source: 'off' | 'manual' };

export default function ScanScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>({ kind: 'scanning' });
  const [draftName, setDraftName] = useState('');
  /** Guards against the camera firing the same code many times a second. */
  const handling = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const onScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (handling.current) return;
      handling.current = true;
      const barcode = result.data;

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const known = await findByBarcode(barcode);
      if (known) {
        await addToList({ id: known.id }, known.defaultQty);
        scheduleSync();
        toast.show({ message: `${known.name} listeye eklendi` });
        router.back();
        return;
      }

      setStage({ kind: 'looking-up', barcode });
      const product = await lookupBarcode(barcode);
      const name = product?.name ?? '';
      setDraftName(name);
      setStage({ kind: 'confirm', barcode, name, source: product ? 'off' : 'manual' });
      handling.current = false;
    },
    [router, toast],
  );

  const confirm = useCallback(async () => {
    if (stage.kind !== 'confirm') return;
    const name = draftName.trim();
    if (!name) return;

    try {
      const itemId = await createItem({ name, barcode: stage.barcode });
      await addToList({ id: itemId });
      scheduleSync();
      toast.show({ message: `${name} listeye eklendi` });
      router.back();
    } catch {
      // A unique-constraint clash means the barcode arrived twice; recover.
      const existing = await findByBarcode(stage.barcode);
      if (existing) {
        await updateItem(existing.id, { name });
        await addToList({ id: existing.id });
        scheduleSync();
        router.back();
        return;
      }
      await logEvent('error', 'Barkodlu ürün eklenemedi', { barcode: stage.barcode });
      toast.show({ message: 'Ürün eklenemedi', tone: 'error' });
    }
  }, [draftName, router, stage, toast]);

  if (!permission) return <Screen />;

  if (!permission.granted) {
    return (
      <Screen>
        <EmptyState
          icon="camera"
          title="Kamera izni gerekiyor"
          description="Barkod okuyabilmek için kamera izni vermen gerekiyor."
          action={{ label: 'İzin ver', onPress: () => void requestPermission() }}
        />
      </Screen>
    );
  }

  if (stage.kind === 'confirm') {
    return (
      <Screen>
        <View style={{ padding: space.lg, gap: space.md }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600' }}>
            {stage.source === 'off' ? 'Bu ürün mü?' : 'Ürün adı'}
          </Text>
          <Caption>
            {stage.source === 'off'
              ? 'Open Food Facts bu adı verdi. Düzeltebilirsin.'
              : 'Bu barkod tanınmadı. Ürünün adını yaz.'}
          </Caption>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            autoFocus
            placeholder="Ürün adı"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Ürün adı"
            style={{
              minHeight: MIN_TOUCH,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.card,
              color: colors.text,
              fontSize: 17,
            }}
          />
          <Caption>Barkod: {stage.barcode}</Caption>
          <Button title="Listeye ekle" onPress={() => void confirm()} />
          <Button
            title="Yeniden tara"
            variant="secondary"
            onPress={() => {
              handling.current = false;
              setStage({ kind: 'scanning' });
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={stage.kind === 'scanning' ? (r) => void onScanned(r) : undefined}
      />
      <View
        style={{
          position: 'absolute',
          left: space.lg,
          right: space.lg,
          bottom: space.xxl,
          alignItems: 'center',
          gap: space.md,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 15, textAlign: 'center' }}>
          {stage.kind === 'looking-up'
            ? 'Ürün aranıyor…'
            : 'Barkodu çerçeveye getir (EAN-13, EAN-8, UPC)'}
        </Text>
        <Button title="Kapat" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}
