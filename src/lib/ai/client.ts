import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';

export interface FirebaseClientStatus {
  isConfigured: boolean;
  hasAppCheck: boolean;
  projectId?: string;
  error?: string;
}

let cachedApp: FirebaseApp | null = null;
let cachedAI: AI | null = null;
let cachedAppCheck: AppCheck | null = null;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export function getFirebaseStatus(): FirebaseClientStatus {
  const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
  return {
    isConfigured,
    hasAppCheck: Boolean(cachedAppCheck),
    projectId: firebaseConfig.projectId || undefined,
  };
}

export function initFirebase(): { app: FirebaseApp | null; ai: AI | null } {
  if (cachedApp && cachedAI) {
    return { app: cachedApp, ai: cachedAI };
  }

  const { isConfigured } = getFirebaseStatus();
  if (!isConfigured) {
    return { app: null, ai: null };
  }

  try {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    cachedApp = app;

    if (typeof window !== 'undefined') {
      const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
      if (debugToken) {
        (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
      } else if (import.meta.env.DEV) {
        (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      const recaptchaKey = import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY;
      if (recaptchaKey) {
        cachedAppCheck = initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
          isTokenAutoRefreshEnabled: true,
        });
      }
    }

    const ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: true,
    });
    cachedAI = ai;

    return { app, ai };
  } catch (error) {
    console.warn('[Airlock] Firebase initialization skipped or failed:', error);
    return { app: null, ai: null };
  }
}

