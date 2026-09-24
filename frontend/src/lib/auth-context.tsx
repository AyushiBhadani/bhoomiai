'use client';

/**
 * AuthContext — BhoomiAI authentication & session management.
 *
 * Login flow:
 *  1. POST /api/auth/login with { email, password }
 *  2. Server returns { access_token, token_type, user: { id, email, role } }
 *  3. Store token + user in localStorage for session persistence
 *
 * Demo mode:
 *  Skip login entirely — useful for hackathon judges who want instant access.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: (role?: 'admin' | 'officer' | 'verifier') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USERS: Record<string, User> = {
  admin:    { id: 1, email: 'admin@bhoomi.gov.in',    role: 'admin'    },
  officer:  { id: 2, email: 'officer@bhoomi.gov.in',  role: 'officer'  },
  verifier: { id: 3, email: 'verifier@bhoomi.gov.in', role: 'verifier' },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const t = localStorage.getItem('bhoomi_token');
      const u = localStorage.getItem('bhoomi_user');
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  const persistSession = useCallback((u: User, t: string) => {
    localStorage.setItem('bhoomi_token', t);
    localStorage.setItem('bhoomi_user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Backend accepts JSON { email, password }
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user: userData } = res.data;
    persistSession(userData, access_token);
  }, [persistSession]);

  const loginAsDemo = useCallback(async (role: 'admin' | 'officer' | 'verifier' = 'admin') => {
    // Use real seeded backend credentials so JWT passes server validation
    const DEMO_CREDS: Record<string, { email: string; password: string }> = {
      admin:    { email: 'admin@bhoomi.gov.in',   password: 'admin123' },
      officer:  { email: 'officer@bhoomi.gov.in', password: 'officer123' },
      verifier: { email: 'officer@bhoomi.gov.in', password: 'officer123' },
    };
    try {
      await login(DEMO_CREDS[role].email, DEMO_CREDS[role].password);
    } catch {
      // Fallback to local demo session if backend is offline (Render cold start)
      persistSession(DEMO_USERS[role], `demo-token-${role}`);
    }
  }, [login, persistSession]);

  const logout = useCallback(() => {
    localStorage.removeItem('bhoomi_token');
    localStorage.removeItem('bhoomi_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, loginAsDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
