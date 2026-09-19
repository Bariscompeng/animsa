/**
 * Every persisted setting, its type and its default. The settings table is a
 * key/value store, so this module is the only place that knows the shapes.
 */
import { DEFAULT_QUIET_HOURS } from '@/domain/quietHours';
import type { QuietHours } from '@/domain/types';

export type SettingsShape = {
  quietHours: QuietHours;
  summaryEnabled: boolean;
  summaryTime: string;
  eveningPreviewEnabled: boolean;
  eveningPreviewTime: string;
  expiryRemindersEnabled: boolean;
  defaultLeadMinutes: number;
  autoDiscoverPlaces: boolean;
  /** Global cooldown between any two location notifications, in minutes. */
  locationCooldownMinutes: number;
  autoAddSuggestions: boolean;
  autoBackupEnabled: boolean;
  lastAutoBackupAt: number | null;
  lastSyncAt: number | null;
  lastSyncSummary: string | null;
  onboardingDone: boolean;
  alarmFallbackNoticeShown: boolean;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastLocationNotifyAt: number | null;
  signatureExpiresAt: number | null;
};

export const DEFAULT_SETTINGS: SettingsShape = {
  quietHours: DEFAULT_QUIET_HOURS,
  summaryEnabled: true,
  summaryTime: '08:00',
  eveningPreviewEnabled: false,
  eveningPreviewTime: '21:00',
  expiryRemindersEnabled: true,
  defaultLeadMinutes: 0,
  autoDiscoverPlaces: true,
  locationCooldownMinutes: 20,
  autoAddSuggestions: false,
  autoBackupEnabled: true,
  lastAutoBackupAt: null,
  lastSyncAt: null,
  lastSyncSummary: null,
  onboardingDone: false,
  alarmFallbackNoticeShown: false,
  lastKnownLat: null,
  lastKnownLng: null,
  lastLocationNotifyAt: null,
  signatureExpiresAt: null,
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof SettingsShape)[];
