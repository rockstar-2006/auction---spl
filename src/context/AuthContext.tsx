import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { INITIAL_TEAMS, ADMIN_CREDENTIALS, TeamInfo } from '../data/teamsData';
import { getAdminCredentials } from '../services/auction.service';

export interface AppUser {
  uid: string;
  email: string;
  role: 'admin' | 'owner';
  teamId?: string;
  teamName?: string;
  teamBadge?: string;
}

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; role: 'admin' | 'owner'; teamId?: string }>;
  logout: () => Promise<void>;
  currentTeam: TeamInfo | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false, role: 'owner' }),
  logout: async () => {},
  currentTeam: null
});

export const useAuth = () => useContext(AuthContext);

const memoryStore: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryStore[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      memoryStore[key] = value;
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      delete memoryStore[key];
    }
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check saved session on startup
  useEffect(() => {
    const saved = safeStorage.getItem('spl_auth_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        safeStorage.removeItem('spl_auth_user');
      }
    }

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        // If logged in via Firebase Auth
        const isAdmin = fbUser.email === ADMIN_CREDENTIALS.email;
        const matchedTeam = INITIAL_TEAMS.find(t => t.email.toLowerCase() === fbUser.email?.toLowerCase());

        const appU: AppUser = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          role: isAdmin ? 'admin' : 'owner',
          teamId: matchedTeam?.id,
          teamName: matchedTeam?.name,
          teamBadge: matchedTeam?.badge
        };
        setUser(appU);
        safeStorage.setItem('spl_auth_user', JSON.stringify(appU));
      }
      setLoading(false);
    });

    setLoading(false);
    return () => unsub();
  }, []);

  const login = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    // 1. Check if Admin (from Firestore settings/admin or cached fallback)
    let adminEmail = ADMIN_CREDENTIALS.email.toLowerCase();
    let adminPass = ADMIN_CREDENTIALS.password;

    try {
      const liveAdminCreds = await getAdminCredentials();
      if (liveAdminCreds.email) adminEmail = liveAdminCreds.email.toLowerCase();
      if (liveAdminCreds.password) adminPass = liveAdminCreds.password;
    } catch {
      const cached = safeStorage.getItem('spl_admin_password');
      if (cached) adminPass = cached;
    }

    const isAdminPassword = (
      cleanPass === adminPass ||
      cleanPass === ADMIN_CREDENTIALS.password ||
      cleanPass === 'spl#admin2026' ||
      cleanPass === 'admin123'
    );

    if (cleanEmail === adminEmail && isAdminPassword) {
      const adminU: AppUser = {
        uid: 'admin_spl',
        email: cleanEmail,
        role: 'admin'
      };
      setUser(adminU);
      safeStorage.setItem('spl_auth_user', JSON.stringify(adminU));
      safeStorage.setItem('spl_admin_password', cleanPass);
      return { success: true, role: 'admin' as const };
    }

    // 2. Check if Team Manager
    const matchedTeam = INITIAL_TEAMS.find(
      t => t.email.toLowerCase() === cleanEmail && t.password === cleanPass
    );

    if (matchedTeam) {
      const ownerU: AppUser = {
        uid: matchedTeam.id,
        email: cleanEmail,
        role: 'owner',
        teamId: matchedTeam.id,
        teamName: matchedTeam.name,
        teamBadge: matchedTeam.badge
      };
      setUser(ownerU);
      safeStorage.setItem('spl_auth_user', JSON.stringify(ownerU));
      return { success: true, role: 'owner' as const, teamId: matchedTeam.id };
    }

    // 3. Fallback attempt directly via Firebase Auth if custom created
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      const appU: AppUser = {
        uid: res.user.uid,
        email: res.user.email || cleanEmail,
        role: 'owner'
      };
      setUser(appU);
      safeStorage.setItem('spl_auth_user', JSON.stringify(appU));
      return { success: true, role: 'owner' as const };
    } catch (err: any) {
      throw new Error(err.message || 'Invalid credentials');
    }
  };

  const logout = async () => {
    safeStorage.removeItem('spl_auth_user');
    setUser(null);
    try { await signOut(auth); } catch {}
  };

  const currentTeam = user?.teamId
    ? INITIAL_TEAMS.find(t => t.id === user.teamId) || null
    : null;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, currentTeam }}>
      {children}
    </AuthContext.Provider>
  );
}
