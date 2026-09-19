import { requireOptionalNativeModule } from 'expo';

export type AlarmAuthState = 'authorized' | 'denied' | 'notDetermined' | 'unavailable';

export type NativeAlarmKitModule = {
  isAvailable(): boolean;
  getAuthorizationState(): AlarmAuthState;
  requestAuthorization(): Promise<AlarmAuthState>;
  scheduleFixed(id: string, epochMs: number, title: string): Promise<void>;
  scheduleWeekly(
    id: string,
    hour: number,
    minute: number,
    weekdays: number[],
    title: string,
  ): Promise<void>;
  cancel(id: string): Promise<void>;
  listIds(): Promise<string[]>;
  cancelAll(): Promise<void>;
};

/**
 * The native module is absent in Jest and in Expo Go, so every caller must be
 * able to cope with `null`. `src/services/alarms.ts` is the only consumer and
 * falls back to notifications when this is missing.
 */
const AlarmKit = requireOptionalNativeModule<NativeAlarmKitModule>('AlarmKit');

export default AlarmKit;
