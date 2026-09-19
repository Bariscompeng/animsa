/**
 * Lightweight toast used for confirmations, errors and the 5-second "undo"
 * window after marking an item bought.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type ToastAction = { label: string; onPress: () => void };

export type ToastOptions = {
  message: string;
  action?: ToastAction;
  /** Milliseconds before it dismisses itself. */
  duration?: number;
  tone?: 'default' | 'error';
};

type ToastContextValue = {
  show: (options: ToastOptions) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
  hide: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  // Animated.Value is stable state, not a render-time ref.
  const opacity = useMemo(() => new Animated.Value(0), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [opacity]);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(options);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(hide, options.duration ?? 3000);
    },
    [hide, opacity],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: space.lg,
            right: space.lg,
            bottom: insets.bottom + 80,
            opacity,
          }}
        >
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              backgroundColor: toast.tone === 'error' ? colors.danger : colors.cardElevated,
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <Text
              style={{
                flex: 1,
                color: toast.tone === 'error' ? '#FFFFFF' : colors.text,
                fontSize: 15,
              }}
            >
              {toast.message}
            </Text>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.action.label}
                hitSlop={8}
                onPress={() => {
                  toast.action?.onPress();
                  hide();
                }}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>
                  {toast.action.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}
