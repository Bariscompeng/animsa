import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * The keyboard's on-screen height, or 0 when it is hidden.
 *
 * `KeyboardAvoidingView` is unreliable for a bar pinned above a tab bar: it has
 * no idea the tab bar exists, so the input ends up underneath the keyboard.
 * Measuring the keyboard directly and lifting the bar by that amount is
 * predictable and works the same in every screen.
 *
 * iOS reports `keyboardWillShow` before the animation, which keeps the bar in
 * step with the keyboard instead of jumping after it.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
