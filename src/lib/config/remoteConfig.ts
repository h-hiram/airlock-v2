import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
  type RemoteConfig,
} from 'firebase/remote-config';
import { initFirebase } from '../ai/client';

export interface RemoteConfigValues {
  geminiCloudModel: string;
  canaryLeakProtectionEnabled: boolean;
  probeThresholdLimit: number;
  strictGroundingRequired: boolean;
  lastFetchedAt: number | null;
  status: 'active' | 'default' | 'disabled';
}

const DEFAULTS = {
  gemini_cloud_model: 'gemini-2.5-flash',
  canary_leak_protection_enabled: true,
  probe_threshold_limit: 3,
  strict_grounding_required: true,
};

let cachedRc: RemoteConfig | null = null;
let currentValues: RemoteConfigValues = {
  geminiCloudModel: DEFAULTS.gemini_cloud_model,
  canaryLeakProtectionEnabled: DEFAULTS.canary_leak_protection_enabled,
  probeThresholdLimit: DEFAULTS.probe_threshold_limit,
  strictGroundingRequired: DEFAULTS.strict_grounding_required,
  lastFetchedAt: null,
  status: 'default',
};

export async function initRemoteConfig(): Promise<RemoteConfigValues> {
  const { app } = initFirebase();
  if (!app || typeof window === 'undefined') {
    return currentValues;
  }

  if (cachedRc) {
    return currentValues;
  }

  try {
    const rc = getRemoteConfig(app);
    rc.settings = {
      minimumFetchIntervalMillis: 60000,
      fetchTimeoutMillis: 10000,
    };
    rc.defaultConfig = DEFAULTS;
    cachedRc = rc;

    const activated = await fetchAndActivate(rc);
    console.log(
      `%c[AIRLOCK:REMOTE-CONFIG] Fetched and activated remote config (updated: ${activated})`,
      'color: #38bdf8;'
    );

    currentValues = {
      geminiCloudModel: getValue(rc, 'gemini_cloud_model').asString() || DEFAULTS.gemini_cloud_model,
      canaryLeakProtectionEnabled: getValue(rc, 'canary_leak_protection_enabled').asBoolean(),
      probeThresholdLimit: getValue(rc, 'probe_threshold_limit').asNumber() || DEFAULTS.probe_threshold_limit,
      strictGroundingRequired: getValue(rc, 'strict_grounding_required').asBoolean(),
      lastFetchedAt: Date.now(),
      status: 'active',
    };

    return currentValues;
  } catch (err) {
    console.warn('[AIRLOCK:REMOTE-CONFIG] Remote config notice (using in-app defaults):', err);
    currentValues.status = 'default';
    return currentValues;
  }
}

export function getRemoteConfigValues(): RemoteConfigValues {
  return currentValues;
}
