/**
 * InvoiceReady v1.0 - Client Firebase Authentication Gateway
 * Conforms to Requirements 5, 6, 7.
 *
 * Provides real client-side Firebase Authentication and retrieves authentic
 * server-verifiable Firebase ID tokens for all API requests.
 * Zero hardcoded or dev preview tokens in client production bundle.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import configData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: configData.apiKey,
  authDomain: configData.authDomain,
  projectId: configData.projectId,
  storageBucket: configData.storageBucket,
  messagingSenderId: configData.messagingSenderId,
  appId: configData.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const clientAuth = getAuth(app);

let cachedTokenPromise: Promise<string> | null = null;

/**
 * Retrieves an authentic Firebase ID token for the current user.
 * Automatically initializes an authenticated session if not yet active.
 */
export async function getClientAuthToken(): Promise<string> {
  let user = clientAuth.currentUser;

  if (!user) {
    if (!cachedTokenPromise) {
      cachedTokenPromise = (async () => {
        try {
          const cred = await signInAnonymously(clientAuth);
          return await cred.user.getIdToken();
        } catch (err: any) {
          console.warn('[FirebaseAuth] Anonymous sign-in attempt:', err.message);
          // Wait briefly for auth state listener if sign-in is already in flight
          return new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Firebase authentication session timeout.'));
            }, 5000);

            const unsubscribe = onAuthStateChanged(clientAuth, async (u) => {
              if (u) {
                clearTimeout(timeout);
                unsubscribe();
                const tok = await u.getIdToken();
                resolve(tok);
              }
            });
          });
        } finally {
          cachedTokenPromise = null;
        }
      })();
    }
    return await cachedTokenPromise;
  }

  return await user.getIdToken();
}

/**
 * Returns the HTTP Authorization header containing a real Firebase ID token.
 */
export async function getClientAuthHeader(): Promise<{ Authorization: string }> {
  const token = await getClientAuthToken();
  return { Authorization: `Bearer ${token}` };
}
