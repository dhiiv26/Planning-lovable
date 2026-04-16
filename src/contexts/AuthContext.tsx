import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { addLog } from '@/lib/logger';

export type UserRole = 'admin' | 'agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (email: string, password: string) => boolean;
  logout: () => void;
  addUser: (email: string, name: string, password: string, role: UserRole) => boolean;
  removeUser: (id: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Default users stored with passwords
interface StoredUser extends User {
  password: string;
}

const DEFAULT_USERS: StoredUser[] = [
  { id: '1', email: 'admin@securite.fr', name: 'Admin Principal', role: 'admin', password: 'admin123' },
  { id: '2', email: 'agent1@securite.fr', name: 'Jean Dupont', role: 'agent', password: 'agent123' },
  { id: '3', email: 'agent2@securite.fr', name: 'Marie Martin', role: 'agent', password: 'agent123' },
];

function getStoredUsers(): StoredUser[] {
  const stored = localStorage.getItem('security_users');
  return stored ? JSON.parse(stored) : DEFAULT_USERS;
}

function saveStoredUsers(users: StoredUser[]) {
  localStorage.setItem('security_users', JSON.stringify(users));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>(getStoredUsers);
  const [user, setUser] = useState<User | null>(() => {
    const session = localStorage.getItem('security_session');
    if (session) {
      const parsed = JSON.parse(session);
      const found = getStoredUsers().find(u => u.id === parsed.id);
      return found ? { id: found.id, email: found.email, name: found.name, role: found.role } : null;
    }
    return null;
  });

  useEffect(() => {
    saveStoredUsers(storedUsers);
  }, [storedUsers]);

  const login = useCallback((email: string, password: string): boolean => {
    const found = storedUsers.find(u => u.email === email && u.password === password);
    if (found) {
      const sessionUser = { id: found.id, email: found.email, name: found.name, role: found.role };
      setUser(sessionUser);
      localStorage.setItem('security_session', JSON.stringify(sessionUser));
      addLog('info', `Connexion réussie: ${found.email}`);
      return true;
    }
    addLog('error', `Échec de connexion: ${email} — identifiants incorrects`);
    return false;
  }, [storedUsers]);

  const logout = useCallback(() => {
    addLog('info', `Déconnexion: ${user?.email}`);
    setUser(null);
    localStorage.removeItem('security_session');
  }, [user]);

  const addUser = useCallback((email: string, name: string, password: string, role: UserRole): boolean => {
    if (storedUsers.some(u => u.email === email)) {
      addLog('error', `Impossible d'ajouter l'utilisateur: ${email} existe déjà`);
      return false;
    }
    const newUser: StoredUser = { id: crypto.randomUUID(), email, name, role, password };
    setStoredUsers(prev => [...prev, newUser]);
    addLog('info', `Utilisateur ajouté: ${name} (${role})`);
    return true;
  }, [storedUsers]);

  const removeUser = useCallback((id: string): boolean => {
    if (id === user?.id) {
      addLog('error', 'Impossible de supprimer votre propre compte');
      return false;
    }
    setStoredUsers(prev => prev.filter(u => u.id !== id));
    addLog('info', `Utilisateur supprimé: ${id}`);
    return true;
  }, [user]);

  const users: User[] = storedUsers.map(({ password, ...u }) => u);

  return (
    <AuthContext.Provider value={{ user, users, login, logout, addUser, removeUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
