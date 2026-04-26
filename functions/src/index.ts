import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

/**
 * Update a user's email (Auth + Firestore profile).
 * Caller must be an admin (role === 'admin' in users/{uid}).
 */
export const updateUserEmail = onCall<{ uid: string; newEmail: string }>(
  { region: 'us-central1' },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError('unauthenticated', 'Connexion requise');
    }

    const db = getFirestore();
    const callerSnap = await db.doc(`users/${callerUid}`).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Réservé aux administrateurs');
    }

    const { uid, newEmail } = request.data || ({} as any);
    if (!uid || !newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
      throw new HttpsError('invalid-argument', 'uid et newEmail valides requis');
    }

    try {
      await getAuth().updateUser(uid, { email: newEmail, emailVerified: false });
      await db.doc(`users/${uid}`).update({ email: newEmail });
      return { success: true };
    } catch (e: any) {
      throw new HttpsError('internal', e?.message || 'Échec de la mise à jour');
    }
  }
);
