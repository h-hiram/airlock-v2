import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import {
  initializeAppCheck,
  CustomProvider,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';

export interface FirebaseClientStatus {
  isConfigured: boolean;
  hasAppCheck: boolean;
  projectId?: string;
  source: 'env' | 'localStorage' | 'none';
  error?: string;
}

export interface CustomFirebaseConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  recaptchaSiteKey?: string;
  debugToken?: string;
}

let cachedApp: FirebaseApp | null = null;
let cachedAI: AI | null = null;
let cachedAppCheck: AppCheck | null = null;

const STABLE_DEBUG_TOKEN = '8b4f4897-6056-485f-be7d-696a6eed1855';

function resolveConfig(): { config: CustomFirebaseConfig | null; source: 'env' | 'localStorage' | 'none' } {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('airlock_firebase_config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CustomFirebaseConfig;
        if (parsed.apiKey && parsed.projectId && parsed.appId) {
          return { config: parsed, source: 'localStorage' };
        }
      } catch (e) {
        console.warn('Failed to parse stored firebase config', e);
      }
    }
  }

  const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProj = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const envApp = import.meta.env.VITE_FIREBASE_APP_ID;

  if (envKey && envProj && envApp) {
    return {
      config: {
        apiKey: envKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: envProj,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: envApp,
        recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY,
        debugToken: import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || STABLE_DEBUG_TOKEN,
      },
      source: 'env',
    };
  }

  return { config: null, source: 'none' };
}

export function getFirebaseStatus(): FirebaseClientStatus {
  const { config, source } = resolveConfig();
  return {
    isConfigured: Boolean(config),
    hasAppCheck: Boolean(cachedAppCheck),
    projectId: config?.projectId,
    source,
  };
}

export function saveCustomFirebaseConfig(config: CustomFirebaseConfig | null): void {
  if (typeof window === 'undefined') return;
  if (!config) {
    localStorage.removeItem('airlock_firebase_config');
  } else {
    localStorage.setItem('airlock_firebase_config', JSON.stringify(config));
  }
  cachedApp = null;
  cachedAI = null;
  cachedAppCheck = null;
}

export function initFirebase(): { app: FirebaseApp | null; ai: AI | null } {
  if (cachedApp && cachedAI) {
    return { app: cachedApp, ai: cachedAI };
  }

  const { config } = resolveConfig();
  if (!config) {
    return { app: null, ai: null };
  }

  try {
    const existing = getApps();
    const app = existing.length > 0 ? existing[0] : initializeApp(config);
    cachedApp = app;

    if (typeof window !== 'undefined') {
      const activeDebugToken =
        config.debugToken && config.debugToken !== 'true'
          ? config.debugToken
          : STABLE_DEBUG_TOKEN;

      console.log(
        '%c[AIRLOCK:FIREBASE] Initializing App Check with debug token:%c ' + activeDebugToken,
        'background: #1e293b; color: #38bdf8; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
        'color: #f1f5f9; font-weight: bold;'
      );

      (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = activeDebugToken;

      try {
        if (config.recaptchaSiteKey) {
          cachedAppCheck = initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(config.recaptchaSiteKey),
            isTokenAutoRefreshEnabled: true,
          });
          console.log('[AIRLOCK:FIREBASE] ReCaptchaEnterpriseProvider active');
        } else {
          cachedAppCheck = initializeAppCheck(app, {
            provider: new CustomProvider({
              getToken: () => Promise.reject(new Error('Debug provider active via FIREBASE_APPCHECK_DEBUG_TOKEN')),
            }),
            isTokenAutoRefreshEnabled: true,
          });
          console.log('[AIRLOCK:FIREBASE] Debug App Check provider initialized for localhost');
        }
      } catch (appCheckErr) {
        console.warn('[AIRLOCK:FIREBASE] App check init warning:', appCheckErr);
      }
    }

    const ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: true,
    });
    cachedAI = ai;
    console.log(
      '%c[AIRLOCK:FIREBASE] Firebase AI Logic Service initialized successfully! (Project: ' + config.projectId + ')',
      'background: #064e3b; color: #34d399; font-weight: bold; padding: 2px 6px; border-radius: 4px;'
    );

    return { app, ai };
  } catch (error) {
    console.warn('[Airlock] Firebase initialization error:', error);
    return { app: null, ai: null };
  }
}
