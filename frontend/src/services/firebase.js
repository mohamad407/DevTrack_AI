import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from 'firebase/auth';

// Fill these in from Firebase Console -> Project Settings -> General -> Your apps -> SDK config.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
// Always show the account chooser, so people with several Google accounts pick the right one
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Email + password sign-up. Firebase only handles the password here. The 6-digit verification
 * code is emailed by the DevTrack backend (see /api/auth/otp/send).
 */
export const signUpWithEmail = async ({ name, email, password }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred.user;
};

export const loginWithEmail = async ({ email, password }) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

/** Fresh Firebase ID token for the currently signed-in user, or null if nobody is signed in. */
export const getCurrentIdToken = () => (auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null));

/**
 * Google sign-in. Google accounts are already verified, so no verification step is needed.
 * AuthContext picks up the new sign-in and creates the DevTrack session automatically.
 */
export const signInWithGoogle = async () => {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
};

// Plain-English messages for Firebase error codes. A null value means "say nothing"
// (for example, the user closed the Google window on purpose).
const AUTH_MESSAGES = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/invalid-email': 'That email address doesn\u2019t look right.',
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in instead.',
  'auth/weak-password': 'Please choose a stronger password (at least 6 characters).',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
  'auth/account-exists-with-different-credential':
    'This email already uses a password. Log in with your email and password instead.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
};

export const friendlyAuthError = (err) => {
  const code = err?.code;
  if (code && Object.prototype.hasOwnProperty.call(AUTH_MESSAGES, code)) return AUTH_MESSAGES[code];
  return 'Something went wrong. Please try again.';
};


export const logout = () => signOut(auth);

export const watchAuthState = (callback) => onAuthStateChanged(auth, callback);

export default app;
