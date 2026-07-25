import admin from 'firebase-admin';

let initialized = false;

/**
 * Lazily initializes Firebase Admin using service account credentials from env vars.
 * Used to verify the Firebase ID token issued after a successful Email OTP
 * sign-in on the client, before we mint our own backend JWT.
 */
export const getFirebaseAdmin = () => {
  if (!initialized) {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      console.warn('⚠️  Firebase Admin credentials missing — Firebase token verification will fail until .env is configured.');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    initialized = true;
  }
  return admin;
};

export const verifyFirebaseToken = async (idToken) => {
  const fbAdmin = getFirebaseAdmin();
  return fbAdmin.auth().verifyIdToken(idToken);
};
