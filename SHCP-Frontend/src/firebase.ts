import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging';

// Replace these values with your actual Firebase project config
// Project Settings → General → Your apps → Web app → SDK setup
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// VAPID key: Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const app        = initializeApp(firebaseConfig);
const auth       = getAuth(app);
const messaging  = getMessaging(app);
const googleProvider = new GoogleAuthProvider();

/**
 * Opens the Google sign-in popup and returns the Firebase ID token.
 * The caller should POST this token to /api/auth/google to receive SHCP JWTs.
 * Returns null if the user closes the popup or an error occurs.
 */
export async function signInWithGoogle(): Promise<string | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    // Sign out of Firebase immediately — SHCP uses its own JWT, not Firebase sessions.
    await signOut(auth);
    return idToken;
  } catch (err: unknown) {
    // popup_closed_by_user is not an error — user simply cancelled
    if ((err as { code?: string })?.code === 'auth/popup-closed-by-user') return null;
    console.error('[Firebase] Google sign-in failed:', err);
    return null;
  }
}

/**
 * Requests notification permission and returns the FCM registration token.
 * Returns null if permission is denied or FCM is unavailable.
 */
export async function requestNotificationToken(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied');
      return null;
    }
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    });
    return token ?? null;
  } catch (err) {
    console.error('[FCM] Failed to get token:', err);
    return null;
  }
}

/**
 * Listens for messages when the app is in the foreground.
 * Background messages are handled by the service worker.
 */
export function onForegroundMessage(handler: (payload: MessagePayload) => void) {
  return onMessage(messaging, handler);
}
