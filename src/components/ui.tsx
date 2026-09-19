/**
 * Shared presentational building blocks.
 *
 * Every text style is relative so Dynamic Type works, every tappable element
 * clears 44 pt, and every icon-only control carries a Turkish
 * `accessibilityLabel`.
 */
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// ---------------------------------------------------------------------- text

type TextProps = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  muted?: boolean;
};

export function Title({ children, style }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text style={[{ color: colors.text, fontSize: 22, fontWeight: '700' }, style]}>{children}</Text>
  );
}

export function Body({ children, style, numberOfLines, muted }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: muted ? colors.textSecondary : colors.text, fontSize: 17 }, style]}
    >
      {children}
    </Text>
  );
}

export function Caption({ children, style, numberOfLines }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: colors.textSecondary, fontSize: 14 }, style]}
    >
      {children}
    </Text>
  );
}

export function SectionHeader({
  children,
  icon,
  trailing,
}: {
  children: ReactNode;
  icon?: SFSymbol;
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.lg,
        paddingTop: space.xl,
        paddingBottom: space.sm,
      }}
    >
      {icon ? <Icon name={icon} size={15} color={colors.textTertiary} /> : null}
      <Text
        style={{
          flex: 1,
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        {children}
      </Text>
      {trailing}
    </View>
  );
}

/**
 * Wraps rows in a rounded, inset card — the shape iOS uses for grouped lists.
 * Edge-to-edge rows on a flat background are what make a screen read as
 * unfinished, so every settings-style list goes through this.
 */
export function CardGroup({ children, footer }: { children: ReactNode; footer?: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <View
        style={{
          marginHorizontal: space.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.card,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
      {footer ? (
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: 13,
            lineHeight: 18,
            paddingHorizontal: space.lg + space.sm,
            paddingTop: space.sm,
          }}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

// --------------------------------------------------------------------- icons

export function Icon({
  name,
  size = 20,
  color,
  label,
}: {
  name: SFSymbol;
  size?: number;
  color?: string;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color ?? colors.textSecondary}
      accessibilityLabel={label}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}

// ------------------------------------------------------------------- buttons

export function IconButton({
  name,
  onPress,
  label,
  color,
  size = 22,
  disabled,
}: {
  name: SFSymbol;
  onPress: () => void;
  /** Required: this control has no visible text. */
  label: string;
  color?: string;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        minWidth: MIN_TOUCH,
        minHeight: MIN_TOUCH,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.5 : 1,
      })}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'plain';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  const background =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.dangerSoft
        : variant === 'secondary'
          ? colors.groupedBackground
          : 'transparent';
  const textColor =
    variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? colors.danger : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          borderRadius: radius.md,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontSize: 17, fontWeight: '600' }}>{title}</Text>
      )}
    </Pressable>
  );
}

// --------------------------------------------------------------------- cards

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'warning' | 'accent';
}) {
  const { colors } = useTheme();
  const background =
    tone === 'warning' ? colors.warningSoft : tone === 'accent' ? colors.accentSoft : colors.card;
  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: radius.lg,
          padding: space.lg,
          marginHorizontal: space.lg,
          marginBottom: space.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Settings-style row. Wraps its children in a 44 pt tappable area. */
export function Row({
  title,
  subtitle,
  icon,
  right,
  onPress,
  destructive,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  icon?: SFSymbol;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: MIN_TOUCH,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        gap: space.md,
      }}
    >
      {icon ? <Icon name={icon} color={destructive ? colors.danger : colors.accent} /> : null}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: destructive ? colors.danger : colors.text,
            fontSize: 17,
          }}
        >
          {title}
        </Text>
        {subtitle ? <Caption style={{ marginTop: 2 }}>{subtitle}</Caption> : null}
      </View>
      {right}
      {onPress && !right ? (
        <Icon name="chevron.right" size={13} color={colors.textTertiary} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.groupedBackground : undefined })}
    >
      {content}
    </Pressable>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  icon,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  icon?: SFSymbol;
}) {
  const { colors } = useTheme();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      icon={icon}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: colors.accent, false: colors.separator }}
          accessibilityLabel={title}
        />
      }
    />
  );
}

export function Separator() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.separator,
        marginLeft: space.lg,
      }}
    />
  );
}

/** Empty state: icon, explanation, and one clear next step. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: SFSymbol;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl }}>
      <Icon name={icon} size={44} color={colors.textTertiary} />
      <Text
        style={{
          color: colors.text,
          fontSize: 18,
          fontWeight: '600',
          marginTop: space.lg,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 15,
          marginTop: space.sm,
          textAlign: 'center',
          lineHeight: 21,
        }}
      >
        {description}
      </Text>
      {action ? (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant="secondary"
          style={{ marginTop: space.lg }}
        />
      ) : null}
    </View>
  );
}

/** Small pill used for parsed NLP fragments and filters. */
export function Chip({
  label,
  onPress,
  tone = 'default',
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'default' | 'accent';
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const background = tone === 'accent' ? colors.accentSoft : colors.groupedBackground;
  const textColor = tone === 'accent' ? colors.accent : colors.textSecondary;

  const inner = (
    <View
      style={{
        backgroundColor: background,
        borderRadius: radius.pill,
        paddingHorizontal: space.md,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: textColor, fontSize: 14, fontWeight: '500' }}>{label}</Text>
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {inner}
    </Pressable>
  );
}

export function Screen({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.groupedBackground }, style]}>{children}</View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
