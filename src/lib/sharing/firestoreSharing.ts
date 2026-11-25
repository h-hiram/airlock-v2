import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { initFirebase } from '../ai/client';
import type { RevocableDisclosure, ApprovedSnippet, DerivedClaim } from '../../types';
import { telemetryStore } from '../network/telemetryStore';

let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let currentUser: User | null = null;

const LOCAL_STORAGE_DISCLOSURES_KEY = 'airlock_saved_disclosures';

function getLocalDisclosures(): Record<string, RevocableDisclosure> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DISCLOSURES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalDisclosure(disc: RevocableDisclosure) {
  if (typeof window === 'undefined') return;
  try {
    const store = getLocalDisclosures();
    store[disc.id] = disc;
    localStorage.setItem(LOCAL_STORAGE_DISCLOSURES_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[Airlock] Failed to persist disclosure to localStorage', e);
  }
}

export function initAuthAndDb(): { db: Firestore | null; auth: Auth | null } {
  if (cachedDb && cachedAuth) {
    return { db: cachedDb, auth: cachedAuth };
  }

  const { app } = initFirebase();
  if (!app) {
    return { db: null, auth: null };
  }

  try {
    cachedDb = getFirestore(app);
    cachedAuth = getAuth(app);

    onAuthStateChanged(cachedAuth, (user) => {
      currentUser = user;
      if (user) {
        console.log(`%c[AIRLOCK:AUTH] Anonymous user active: ${user.uid}`, 'color: #38bdf8;');
      }
    });

    return { db: cachedDb, auth: cachedAuth };
  } catch (err) {
    console.warn('[Airlock] Firestore / Auth initialization notice:', err);
    return { db: null, auth: null };
  }
}

export async function ensureAnonymousAuth(): Promise<User | null> {
  const { auth } = initAuthAndDb();
  if (!auth) return null;

  if (currentUser) return currentUser;

  try {
    const credential = await signInAnonymously(auth);
    currentUser = credential.user;
    console.log(`[AIRLOCK:AUTH] Signed in anonymously as ${currentUser.uid}`);
    return currentUser;
  } catch (error) {
    console.warn('[AIRLOCK:AUTH] Anonymous sign-in notice (will proceed with local identifier):', error);
    return null;
  }
}

export interface CreateDisclosureInput {
  requesterName: string;
  requestText: string;
  counterProposal: string;
  coverLetter: string;
  approvedSnippets: ApprovedSnippet[];
  derivedClaims?: DerivedClaim[];
  sha256Receipt: string;
  salt?: string;
  expiresInDays?: number;
}

export async function publishRevocableDisclosure(
  input: CreateDisclosureInput
): Promise<{ disclosure: RevocableDisclosure; shareUrl: string }> {
  const { db } = initAuthAndDb();
  const user = await ensureAnonymousAuth();

  const ownerUid = user?.uid || `local_${Math.random().toString(36).slice(2, 10)}`;
  const disclosureId = `disc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const expiresInDays = input.expiresInDays || 7;
  const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;

  const disclosure: RevocableDisclosure = {
    id: disclosureId,
    ownerUid,
    requesterName: input.requesterName,
    requestText: input.requestText,
    counterProposal: input.counterProposal,
    coverLetter: input.coverLetter,
    approvedSnippets: input.approvedSnippets,
    derivedClaims: input.derivedClaims || [],
    createdAt: now,
    expiresAt,
    revoked: false,
    viewCount: 0,
    sha256Receipt: input.sha256Receipt,
    salt: input.salt,
  };

  // Always save to device local cache for instant zero-latency retrieval
  saveLocalDisclosure(disclosure);

  // If Firestore is available, sync to Cloud Firestore
  if (db) {
    try {
      const payloadString = JSON.stringify(disclosure);
      const payloadBytes = new TextEncoder().encode(payloadString).length;

      const docRef = doc(db, 'disclosures', disclosureId);
      await setDoc(docRef, disclosure);

      telemetryStore.logRequest(
        'firestore',
        'POST',
        `https://firestore.googleapis.com/v1/projects/airlock/databases/(default)/documents/disclosures/${disclosureId}`,
        payloadBytes,
        180
      );

      console.log(`%c[AIRLOCK:FIRESTORE] Published revocable disclosure: ${disclosureId}`, 'color: #34d399; font-weight: bold;');
    } catch (err) {
      console.warn('[AIRLOCK:FIRESTORE] Syncing to remote Firestore failed, saved locally:', err);
    }
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?verify=${disclosureId}`;
  return { disclosure, shareUrl };
}

export async function fetchPublicDisclosure(disclosureId: string): Promise<RevocableDisclosure | null> {
  const { db } = initAuthAndDb();

  // Try fetching from Firestore first
  if (db) {
    try {
      const docRef = doc(db, 'disclosures', disclosureId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data() as RevocableDisclosure;

        // Atomically increment counter in Firestore
        try {
          await updateDoc(docRef, { viewCount: increment(1) });
          data.viewCount = (data.viewCount || 0) + 1;
        } catch {
          // ignore increment error
        }

        telemetryStore.logRequest(
          'firestore',
          'GET',
          `https://firestore.googleapis.com/v1/projects/airlock/databases/(default)/documents/disclosures/${disclosureId}`,
          80,
          JSON.stringify(data).length
        );

        return data;
      }
    } catch (e) {
      console.warn('[AIRLOCK:FIRESTORE] Cloud fetch error, trying local cache:', e);
    }
  }

  // Fallback to local store
  const localStore = getLocalDisclosures();
  if (localStore[disclosureId]) {
    const cached = localStore[disclosureId];
    cached.viewCount = (cached.viewCount || 0) + 1;
    saveLocalDisclosure(cached);
    return cached;
  }

  return null;
}

export async function revokeDisclosure(disclosureId: string): Promise<boolean> {
  const { db } = initAuthAndDb();
  const now = Date.now();

  // Update local store with privacy tombstone
  const localStore = getLocalDisclosures();
  if (localStore[disclosureId]) {
    localStore[disclosureId].revoked = true;
    localStore[disclosureId].revokedAt = now;
    localStore[disclosureId].tombstone = true;
    localStore[disclosureId].coverLetter = '[REVOKED - SENSITIVE PAYLOAD ZEROED BY ISSUER]';
    localStore[disclosureId].counterProposal = '[REVOKED]';
    localStore[disclosureId].approvedSnippets = [];
    localStore[disclosureId].derivedClaims = [];
    saveLocalDisclosure(localStore[disclosureId]);
  }

  // Update Firestore with privacy tombstone
  if (db) {
    try {
      const docRef = doc(db, 'disclosures', disclosureId);
      await updateDoc(docRef, {
        revoked: true,
        revokedAt: now,
        tombstone: true,
        coverLetter: '[REVOKED - SENSITIVE PAYLOAD ZEROED BY ISSUER]',
        counterProposal: '[REVOKED]',
        approvedSnippets: [],
        derivedClaims: [],
      });

      telemetryStore.logRequest(
        'firestore',
        'PATCH',
        `https://firestore.googleapis.com/v1/projects/airlock/databases/(default)/documents/disclosures/${disclosureId}`,
        120,
        120
      );

      console.log(`%c[AIRLOCK:FIRESTORE] Tombstoned & revoked disclosure: ${disclosureId}`, 'color: #f43f5e; font-weight: bold;');
      return true;
    } catch (err) {
      console.warn('[AIRLOCK:FIRESTORE] Failed to update remote Firestore revocation:', err);
    }
  }

  return true;
}

export function getAllSavedDisclosures(): RevocableDisclosure[] {
  const store = getLocalDisclosures();
  return Object.values(store).sort((a, b) => b.createdAt - a.createdAt);
}

export function getCurrentUserUid(): string | null {
  return currentUser?.uid || null;
}
