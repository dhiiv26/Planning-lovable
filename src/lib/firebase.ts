// Firebase initialization — Auth + Firestore with offline IndexedDB cache
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// Public web config (safe to expose — security is enforced by Firestore rules)
const firebaseConfig = {
  apiKey: 'AIzaSyDxKWFCENa9Co5tjsFAeQYjo2yzJH7W6lc',
  authDomain: 'planning-lovable.firebaseapp.com',
  projectId: 'planning-lovable',
  storageBucket: 'planning-lovable.firebasestorage.app',
  messagingSenderId: '371111432452',
  appId: '1:371111432452:web:b84ef6a82db458f6bbc051',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Firestore with offline persistent cache (IndexedDB, multi-tab safe)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
