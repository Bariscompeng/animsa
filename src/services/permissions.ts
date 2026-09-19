/**
 * One place that knows the state of every permission the app can ask for, so
 * Settings, Onboarding and Diagnostics all show the same story.
 */
import { Linking } from 'react-native';
import * as Camera from 'expo-camera';

import type { AlarmAuthState } from '@modules/alarm-kit';

import * as alarms from './alarms';
import * as locationService from './location';
import * as notifications from './notifications';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable' | 'partial';

export type PermissionsSnapshot = {
  notifications: PermissionState;
  alarms: PermissionState;
  location: PermissionState;
  camera: PermissionState;
  alarmAuthState: AlarmAuthState;
};

export const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: 'İzin verildi',
  denied: 'Reddedildi',
  undetermined: 'Henüz sorulmadı',
  unavailable: 'Kullanılamıyor',
  partial: 'Kısmen verildi',
};

export async function snapshot(): Promise<PermissionsSnapshot> {
  const [notif, loc, cam] = await Promise.all([
    notifications.getPermissionStatus(),
    locationService.getPermissions(),
    Camera.Camera.getCameraPermissionsAsync(),
  ]);

  const alarmState = alarms.getAuthorizationState();

  return {
    notifications: notif.granted ? 'granted' : notif.canAskAgain ? 'undetermined' : 'denied',
    // "When in use" is not enough for background geofencing — say so plainly.
    location: loc.canMonitor
      ? 'granted'
      : loc.foreground === 'granted'
        ? 'partial'
        : loc.foreground === 'denied'
          ? 'denied'
          : 'undetermined',
    camera: cam.granted ? 'granted' : cam.canAskAgain ? 'undetermined' : 'denied',
    alarms:
      alarmState === 'authorized'
        ? 'granted'
        : alarmState === 'denied'
          ? 'denied'
          : alarmState === 'notDetermined'
            ? 'undetermined'
            : 'unavailable',
    alarmAuthState: alarmState,
  };
}

export async function requestNotifications(): Promise<boolean> {
  return notifications.requestPermission();
}

export async function requestAlarms(): Promise<AlarmAuthState> {
  return alarms.requestAuthorization();
}

export async function requestCamera(): Promise<boolean> {
  const result = await Camera.Camera.requestCameraPermissionsAsync();
  return result.granted;
}

export async function requestLocationWhenInUse(): Promise<boolean> {
  return locationService.requestForeground();
}

export async function requestLocationAlways(): Promise<boolean> {
  return locationService.requestBackground();
}

/** Opens the app's own page in the Settings app. */
export async function openSystemSettings(): Promise<void> {
  await Linking.openSettings();
}
