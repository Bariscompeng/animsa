/**
 * The orange strip that appears on the Today screen when the sideload
 * signature is about to expire (§3.10). Tapping it opens AltStore.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { formatDateTime, formatDuration } from '@/domain/format';
import type { SignatureStatus } from '@/domain/provision';
import { openAltStore } from '@/services/altstore';
import * as signature from '@/services/signature';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function SignatureBanner() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<SignatureStatus | null>(null);

  useEffect(() => {
    void signature.currentStatus().then(setStatus);
  }, []);

  const open = useCallback(() => {
    void openAltStore().then((opened) => {
      if (!opened) {
        Alert.alert(
          'AltStore bulunamadı',
          "Telefonda AltStore kurulu değil gibi görünüyor. AltStore'u açıp Anımsa'nın yanındaki Yenile'ye basman gerekiyor.",
        );
      }
    });
  }, []);

  if (!status?.showBanner || status.msRemaining === null) return null;

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`İmza süresi ${formatDuration(status.msRemaining)} sonra doluyor. AltStore'u açmak için dokun.`}
      style={({ pressed }) => ({
        marginHorizontal: space.lg,
        marginTop: space.md,
        padding: space.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.warningSoft,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name="exclamationmark.triangle.fill" color={colors.warning} size={22} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.warning, fontSize: 15, fontWeight: '600' }}>
          İmza {formatDuration(status.msRemaining)} sonra doluyor
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
          {status.expiresAt ? formatDateTime(status.expiresAt) : ''}
          {" · AltStore'u açıp Yenile'ye bas"}
        </Text>
      </View>
      <Icon name="chevron.right" color={colors.warning} size={14} />
    </Pressable>
  );
}
