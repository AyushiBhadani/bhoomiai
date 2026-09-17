'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home, User, Mail, Phone, Lock, Upload, FileCheck,
  Eye, EyeOff, AlertCircle, Loader2, CheckCircle, ArrowRight, ArrowLeft,
} from 'lucide-react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const ID_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'passport', label: 'Passport' },
];

export default function CitizenRegisterPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Step 2 fields
  const [idType, setIdType] = useState('aadhaar');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (f: File) => {
    setIdFile(f);
    if (f.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  };

  const validateStep1 = () => {
    if (!fullName.trim()) { setError('Please enter your full name'); return false; }
    if (!email.trim()) { setError('Please enter your email'); return false; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return false; }
    if (password !== confirmPwd) { setError('Passwords do not match'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!idFile) { setError('Please upload a proof of identity'); return; }
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append('full_name', fullName);
      form.append('email', email);
      form.append('phone', phone);
      form.append('password', password);
      form.append('id_proof_type', idType);
      form.append('id_proof', idFile);

      const res = await axios.post(`${API}/citizen/register`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { access_token, user } = res.data;
      localStorage.setItem('citizen_token', access_token);
      localStorage.setItem('citizen_user', JSON.stringify(user));
      setStep(3);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg mb-4">
            <Home size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Citizen Registration</h1>
          <p className="text-slate-500 mt-1 text-sm">Create your account to digitize your land records</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {step > s ? <CheckCircle size={16} /> : s}
              </div>
              {s < 3 && <div className={`h-0.5 w-16 transition-all ${step > s ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-5 text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1 — Personal Info */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-5 flex items-center gap-2">
                <User size={20} className="text-emerald-500" /> Personal Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="Ramesh Kumar" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="your@email.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="+91 98765 43210" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type={showPwd ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="At least 6 characters" />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password *</label>
                  <input type="password" required value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="Repeat your password" />
                </div>
              </div>
              <button
                onClick={() => { setError(null); if (validateStep1()) { setError(null); setStep(2); } }}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-all"
              >
                Next: Upload ID Proof <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2 — ID Proof */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-5 flex items-center gap-2">
                <FileCheck size={20} className="text-emerald-500" /> Identity Verification
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">ID Proof Type *</label>
                <select value={idType} onChange={e => setIdType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  idFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                }`}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="ID Preview" className="max-h-48 mx-auto rounded-xl object-contain" />
                ) : (
                  <div>
                    <Upload size={32} className="mx-auto text-slate-400 mb-3" />
                    <p className="text-slate-700 font-medium text-sm">{idFile ? idFile.name : 'Click to upload your ID'}</p>
                    <p className="text-slate-400 text-xs mt-1">JPG, PNG, or PDF accepted</p>
                  </div>
                )}
                {idFile && !previewUrl && (
                  <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium text-sm mt-2">
                    <FileCheck size={16} /> {idFile.name}
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf"
                className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)}
                  className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-3 rounded-xl transition-all">
                  <ArrowLeft size={16} /> Back
                </button>
                <button onClick={handleSubmit} disabled={loading || !idFile}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-60">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Success */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={40} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Account Created!</h2>
              <p className="text-slate-500 text-sm mb-2">Welcome, <strong>{fullName}</strong>!</p>
              <p className="text-slate-400 text-sm mb-8">
                Your account is ready. You can now upload your land documents for digitization and track their verification status.
              </p>
              <button onClick={() => router.push('/citizen/dashboard')}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-all">
                Go to My Dashboard <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Already have an account */}
        {step < 3 && (
          <div className="text-center mt-6 text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/citizen/login" className="text-emerald-600 font-semibold hover:underline">Sign in here</Link>
          </div>
        )}
      </div>
    </div>
  );
}
