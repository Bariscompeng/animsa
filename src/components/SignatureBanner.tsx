/**
 * The strip that appears on the Today screen when the sideload signature is
 * about to expire (§3.10).
 *
 * It carries its own amber gradient rather than the usual card treatment: this
 * is the one notice where ignoring it means the app stops opening, so it has
 * to out-rank everything else on the screen.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from '@/components/ui';
import { formatDuration } from '@/domain/format';
import type { SignatureStatus } from '@/domain/provision';
import { openAltStore } from '@/services/altstore';
import * as signature from '@/services/signature';
import { hues, radius, space } from '@/theme/tokens';
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

  const remaining = formatDuration(status.msRemaining);
  const urgent = status.hoursRemaining !== null && status.hoursRemaining < 24;

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`İmza süresi ${remaining} sonra doluyor. Yenilemek için dokun.`}
      style={({ pressed }) => ({
        marginHorizontal: space.lg,
        marginTop: space.sm,
        marginBottom: space.md,
        borderRadius: radius.lg,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <LinearGradient
        colors={
          urgent
            ? ['rgba(239,68,68,0.28)', 'rgba(239,68,68,0.10)']
            : ['rgba(245,158,11,0.28)', 'rgba(245,158,11,0.08)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.md,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: urgent ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name="calendar.badge.exclamationmark"
            size={22}
            color={urgent ? hues.red : hues.amber}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: urgent ? hues.red : hues.amber,
              fontSize: 16,
              fontWeight: '700',
            }}
          >
            {remaining} sonra doluyor
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 1 }}>
            {"AltStore'u açıp Yenile'ye bas"}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: urgent ? hues.red : hues.amber,
            borderRadius: radius.pill,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
          }}
        >
          <Text style={{ color: '#1A1205', fontSize: 15, fontWeight: '700' }}>Yenile</Text>
        </View>

        <Icon name="chevron.right" size={13} color={colors.textTertiary} />
      </LinearGradient>
    </Pressable>
  );
}
