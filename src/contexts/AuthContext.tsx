import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  User as FbUser,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import {
  doc as fsDoc,
  getDoc as fsGetDoc,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  collection as fsCollection,
  onSnapshot as fsOnSnapshot,
} from 'firebase/firestore';
import { auth, db, functions } from '@/lib/firebase';
import { addLog } from '@/lib/logger';

export type UserRole = 'admin' | 'agent';

export interface User {
  id: string; // Firebase UID
  email: string;
  name: string; // "prenom nom"
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  users: User[];
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addUser: (email: string, name: string, password: string, role: UserRole) => Promise<boolean>;
  removeUser: (id: string) => Promise<boolean>;
  updateUserRole: (id: string, role: UserRole) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  updateUserEmail: (uid: string, newEmail: string) => Promise<boolean>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface UserDoc {
  prenom?: string;
  nom?: string;
  role: UserRole;
  email?: string;
}

function userDocToUser(uid: string, data: UserDoc, fallbackEmail = ''): User {
  const name = [data.prenom, data.nom].filter(Boolean).join(' ').trim() || data.email || fallbackEmail;
  return {
    id: uid,
    email: data.email || fallbackEmail,
    name,
    role: data.role || 'agent',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase auth state — load profile from users/{uid}
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser: FbUser | null) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const ref = fsDoc(db, 'users', fbUser.uid);
        const snap = await fsGetDoc(ref);
        if (snap.exists()) {
          setUser(userDocToUser(fbUser.uid, snap.data() as UserDoc, fbUser.email || ''));
        } else {
          // No profile yet — create a minimal "agent" doc
          const fallback: UserDoc = {
            prenom: fbUser.email?.split('@')[0] || 'Utilisateur',
            nom: '',
            role: 'agent',
            email: fbUser.email || '',
          };
          await fsSetDoc(ref, fallback);
          setUser(userDocToUser(fbUser.uid, fallback, fbUser.email || ''));
          addLog('warn', `Profil créé automatiquement pour ${fbUser.email} (rôle agent par défaut)`);
        }
      } catch (e: any) {
        addLog('error', `Erreur chargement profil: ${e?.message || e}`);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // Listen to all users — admin sees the full list, agents see at least themselves
  useEffect(() => {
    if (!user) {
      setUsers([]);
      return;
    }
    const col = fsCollection(db, 'users');
    const unsub = fsOnSnapshot(
      col,
      snap => {
        const list: User[] = snap.docs.map(d => userDocToUser(d.id, d.data() as UserDoc));
        setUsers(list);
      },
      err => addLog('error', `Erreur lecture utilisateurs: ${err.message}`)
    );
    return unsub;
  }, [user]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      addLog('info', `Connexion réussie: ${email}`);
      return true;
    } catch (e: any) {
      addLog('error', `Échec connexion ${email}: ${e?.code || e?.message}`);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    addLog('info', `Déconnexion: ${user?.email}`);
    await signOut(auth);
  }, [user]);

  const addUser = useCallback(
    async (email: string, name: string, password: string, role: UserRole): Promise<boolean> => {
      try {
        // NOTE: createUserWithEmailAndPassword auto-signs-in the new user — this would
        // log out the current admin. In a production setup this should be done via a
        // Cloud Function. For now we create + write the profile, then let the admin
        // log back in if needed.
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const [prenom, ...rest] = name.trim().split(' ');
        await fsSetDoc(fsDoc(db, 'users', cred.user.uid), {
          prenom: prenom || '',
          nom: rest.join(' '),
          role,
          email,
        });
        addLog('info', `Utilisateur ajouté: ${name} (${role})`);
        return true;
      } catch (e: any) {
        addLog('error', `Ajout utilisateur ${email} échoué: ${e?.code || e?.message}`);
        return false;
      }
    },
    []
  );

  const removeUser = useCallback(
    async (id: string): Promise<boolean> => {
      if (id === user?.id) {
        addLog('error', 'Impossible de supprimer votre propre compte');
        return false;
      }
      try {
        // Only deletes the Firestore profile. Removing the auth account requires Admin SDK.
        await fsDeleteDoc(fsDoc(db, 'users', id));
        addLog('warn', `Profil supprimé: ${id} (compte Auth à supprimer manuellement dans la console Firebase)`);
        return true;
      } catch (e: any) {
        addLog('error', `Suppression échouée: ${e?.message}`);
        return false;
      }
    },
    [user]
  );

  const updateUserRole = useCallback(
    async (id: string, role: UserRole): Promise<boolean> => {
      if (id === user?.id && role !== 'admin') {
        addLog('error', 'Impossible de retirer votre propre rôle admin');
        return false;
      }
      try {
        await fsUpdateDoc(fsDoc(db, 'users', id), { role });
        addLog('info', `Rôle mis à jour pour ${id} → ${role}`);
        return true;
      } catch (e: any) {
        addLog('error', `Mise à jour du rôle échouée: ${e?.message}`);
        return false;
      }
    },
    [user]
  );

  const sendPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    try {
      await sendPasswordResetEmail(auth, email);
      addLog('info', `Email de réinitialisation envoyé à ${email}`);
      return true;
    } catch (e: any) {
      addLog('error', `Reset mot de passe échoué pour ${email}: ${e?.code || e?.message}`);
      return false;
    }
  }, []);

  const updateUserEmail = useCallback(async (uid: string, newEmail: string): Promise<boolean> => {
    try {
      const fn = httpsCallable<{ uid: string; newEmail: string }, { success: boolean }>(
        functions,
        'updateUserEmail'
      );
      await fn({ uid, newEmail });
      addLog('info', `Email mis à jour pour ${uid} → ${newEmail}`);
      return true;
    } catch (e: any) {
      addLog('error', `Mise à jour email échouée: ${e?.code || e?.message}`);
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        loading,
        login,
        logout,
        addUser,
        removeUser,
        updateUserRole,
        sendPasswordReset,
        updateUserEmail,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
