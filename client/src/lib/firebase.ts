import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Google Sign-In is backed by an OAuth 2.0 Client ID configured in Google Cloud Console.
// Enable Google provider in Firebase Console → Authentication → Sign-in method.
// This satisfies the manuscript's "Google Console Authentication" requirement.

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function registerWithEmail(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function loginWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: unknown) {
    const error = err as { code?: string; customData?: { email?: string } };
    if (error.code === 'auth/account-exists-with-different-credential' && error.customData?.email) {
      const methods = await fetchSignInMethodsForEmail(auth, error.customData.email);
      if (methods.includes('password')) {
        throw new Error(
          'An account with this email already exists. Please sign in with email/password first, then link Google from your profile.'
        );
      }
    }
    throw err;
  }
}

export async function linkGoogleAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}

export async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(true);
}
