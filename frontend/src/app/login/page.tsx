'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, AlertCircle, Loader2, Eye, EyeOff, Layers, CheckCircle2, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const FEATURES = [
  'AI-powered OCR for printed & handwritten records',
  'Automated field extraction with confidence scores',
  'Intelligent validation & duplicate detection',
  'Interactive GIS cadastral parcel map',
  'Role-based access control (Admin / Officer / Verifier)',
  'Immutable audit trail for every action',
  'Export to CSV, JSON and verification reports',
];

const DEMO_ROLES = [
  { role: 'admin'    as const, label: 'Administrator',       desc: 'Full system access', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { role: 'officer'  as const, label: 'Land Record Officer', desc: 'Upload & process',   color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { role: 'verifier' as const, label: 'Verifier',            desc: 'Review & approve',  color: 'text-amber-700 bg-amber-50 border-amber-200' },
];

export default function LoginPage() {
  const { login, loginAsDemo } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Login failed. Check credentials or ensure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = (role: 'admin' | 'officer' | 'verifier') => {
    loginAsDemo(role);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: Branding ─────────────────────────────── */}
      <div className="hidden lg:flex w-[45%] bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-64 h-64 bg-emerald-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-blue-400 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <Layers size={24} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-black text-2xl tracking-tight">
                Bhoomi<span className="text-emerald-400">AI</span>
              </p>
              <p className="text-slate-400 text-xs font-medium">Intelligent Land Record Digitization</p>
            </div>
          </div>

          {/* Ministry badge */}
          <div className="mb-8 inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-full px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 text-xs font-medium">Ministry of Rural Development</span>
          </div>

          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            Digitizing India&#39;s<br />
            <span className="text-emerald-400">Land Records</span><br />
            with AI
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-10">
            An end-to-end AI platform for scanning, extracting, validating and
            managing legacy land records across all Indian states and districts.
          </p>

          {/* Features */}
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-300 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <span className="w-8 h-px bg-slate-700" />
            Department of Land Resources &middot; Smart India Hackathon
            <span className="w-8 h-px bg-slate-700" />
          </div>
        </div>
      </div>

      {/* ── Right panel: Login form ──────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <Layers size={20} className="text-emerald-500" />
            <span className="font-black text-xl text-slate-900">Bhoomi<span className="text-emerald-500">AI</span></span>
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to access the Land Record System</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@gov.in"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or try demo access</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Demo role picker */}
          <div>
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="w-full flex items-center justify-between px-4 py-3 border border-slate-200 rounded-xl bg-white hover:border-slate-300 transition text-sm font-medium text-slate-700"
            >
              <span>Continue as Demo User</span>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${showDemo ? 'rotate-180' : ''}`} />
            </button>
            {showDemo && (
              <div className="mt-2 space-y-2">
                {DEMO_ROLES.map(({ role, label, desc, color }) => (
                  <button
                    key={role}
                    onClick={() => handleDemo(role)}
                    className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl text-left transition hover:shadow-sm ${color}`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs opacity-70">{desc}</p>
                    </div>
                    <span className="text-xs font-bold opacity-60 capitalize">{role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Credentials hint */}
          <div className="mt-6 bg-slate-100 rounded-xl p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700 mb-2">Real login credentials:</p>
            <p>admin@bhoomi.gov.in / <span className="font-mono">password</span></p>
            <p>officer@bhoomi.gov.in / <span className="font-mono">password</span></p>
            <p>verifier@bhoomi.gov.in / <span className="font-mono">password</span></p>
          </div>

          {/* Citizen Portal separator */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs text-slate-400 uppercase tracking-wider">
              <span className="bg-white px-3">or</span>
            </div>
          </div>

          {/* Citizen Portal Button */}
          <a
            href="/citizen/login"
            className="mt-4 flex items-center justify-between w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl px-4 py-3 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg">🏠</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-emerald-800">Citizen Portal</p>
                <p className="text-xs text-emerald-600">Track your land record digitization requests</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-emerald-500 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}


