import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from 'firebase/auth';

// Fill these in from Firebase Console -> Project Settings -> General -> Your apps -> SDK config.
// Enable "Email/Password" provider, and turn on "Email link (passwordless sign-in)" or
// use Email/Password + sendEmailVerification for the OTP-style verification link flow used here.
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

/**
 * "Email OTP" here is implemented as Firebase's email verification link flow:
 * 1. signUpWithEmail() creates the account and immediately emails a one-time verification link.
 * 2. The user clicks the link (or pastes the emailed code into the OTP screen, if you wire up
 *    a custom OTP code via Firebase Auth's email link sign-in instead — see comment below).
 * 3. Once verified, loginWithEmail() succeeds and the backend accepts the session.
 *
 * For a numeric-code OTP UX (rather than a magic link), swap this for Firebase's
 * `PhoneAuthProvider`-style flow using a custom email OTP provider (e.g. Firebase Extensions'
 * "Trigger Email" + Firestore-stored codes), since core Firebase Auth doesn't natively send
 * numeric email codes. This scaffold uses the email-link verification approach, which is
 * natively supported and secure by default.
 */
export const signUpWithEmail = async ({ name, email, password }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
  return cred.user;
};

export const loginWithEmail = async ({ email, password }) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  if (!cred.user.emailVerified) {
    await sendEmailVerification(cred.user);
  }
  return cred.user;
};

export const resendVerificationEmail = async () => {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
};

export const requestPasswordReset = (email) => sendPasswordResetEmail(auth, email);
export const confirmReset = (code, newPassword) => confirmPasswordReset(auth, code, newPassword);

export const logout = () => signOut(auth);

export const watchAuthState = (callback) => onAuthStateChanged(auth, callback);

export default app;
