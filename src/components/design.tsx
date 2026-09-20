/**
 * The visual vocabulary the redesign is built from: a coloured icon badge, a
 * section header that pairs one with a count, a small status pill, and the
 * hero header at the top of a tab.
 *
 * These live apart from `ui.tsx` (which holds the plain, functional controls)
 * so the decorative layer can change without touching form plumbing.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { hueSoft, hues, radius, space, type, type Hue } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** A rounded square holding a tinted SF Symbol. The core repeating motif. */
export function IconBadge({
  icon,
  hue,
  size = 40,
  style,
}: {
  icon: SFSymbol;
  hue: Hue;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2.6,
          backgroundColor: hueSoft(hue),
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <SymbolView
        name={icon}
        size={size * 0.5}
        tintColor={hues[hue]}
        resizeMode="scaleAspectFit"
        style={{ width: size * 0.5, height: size * 0.5 }}
      />
    </View>
  );
}

/**
 * Section header: a small tinted icon, a coloured title, and the count pushed
 * to the right — the pattern that makes a long list scannable.
 */
export function SectionTitle({
  icon,
  hue,
  title,
  count,
  onPress,
}: {
  icon: SFSymbol;
  hue: Hue;
  title: string;
  count?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.lg,
        paddingTop: space.xl,
        paddingBottom: space.md,
      }}
    >
      <IconBadge icon={icon} hue={hue} size={28} />
      <Text
        style={{
          flex: 1,
          color: hues[hue],
          fontSize: 19,
          fontWeight: '700',
        }}
      >
        {title}
      </Text>
      {count ? (
        <Text style={{ color: colors.textTertiary, fontSize: type.caption.size }}>{count}</Text>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {body}
    </Pressable>
  );
}

/** Small uppercase pill — "ÖNEMLİ", "ALARM" and similar markers. */
export function Badge({ label, hue = 'amber' }: { label: string; hue?: Hue }) {
  return (
    <View
      style={{
        backgroundColor: hueSoft(hue),
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          color: hues[hue],
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.5,
        }}
      >
        {label.toLocaleUpperCase('tr-TR')}
      </Text>
    </View>
  );
}

/**
 * The header at the top of a tab: date, large title, one line of context, and
 * a soft gradient bleeding in from the top-right corner.
 */
export function HeroHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: colors.background }}>
      <LinearGradient
        // Warm wash in the corner, fading to nothing before the content starts.
        colors={
          isDark
            ? ['rgba(255,148,71,0.28)', 'rgba(139,92,246,0.14)', 'rgba(0,0,0,0)']
            : ['rgba(255,122,26,0.22)', 'rgba(139,92,246,0.10)', 'rgba(255,255,255,0)']
        }
        start={{ x: 1, y: 0 }}
        end={{ x: 0.1, y: 1 }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          left: 0,
          height: 220,
        }}
      />

      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: space.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            {eyebrow ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: type.caption.size,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                }}
              >
                {eyebrow.toLocaleUpperCase('tr-TR')}
              </Text>
            ) : null}
            <Text
              style={{
                color: colors.text,
                fontSize: type.display.size,
                fontWeight: type.display.weight,
                marginTop: 2,
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: type.callout.size,
                  marginTop: space.xs,
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {actions ? (
            <View style={{ flexDirection: 'row', gap: space.sm, paddingTop: space.sm }}>
              {actions}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Circular icon button for the hero header's top-right corner. */
export function HeroAction({
  icon,
  label,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.cardElevated,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <SymbolView
        name={icon}
        size={19}
        tintColor={colors.text}
        resizeMode="scaleAspectFit"
        style={{ width: 19, height: 19 }}
      />
    </Pressable>
  );
}

/** Card wrapper used by the dashboard blocks. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          marginHorizontal: space.lg,
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
