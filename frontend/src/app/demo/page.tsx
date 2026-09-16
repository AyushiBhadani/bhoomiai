'use client';

/**
 * BhoomiAI Demo Flow — A stunning judge-facing guided walkthrough
 * of the complete AI pipeline with animated steps and live links.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Upload, Search, CheckSquare,
  Map, Bot, Users, ShieldCheck, ChevronRight,
  Play, Sparkles, Flag, ArrowRight, Zap,
  FileText, Shield, Globe, Hash, Star,
} from 'lucide-react';

interface DemoStep {
  number: number;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  href: string;
  actionLabel: string;
  highlight: string;
  features: string[];
}

const STEPS: DemoStep[] = [
  {
    number: 1,
    title: 'Dashboard Overview',
    subtitle: 'Command Centre',
    description: 'See the complete state of India\'s land records at a glance — total digitized documents, AI confidence averages, pipeline status, and real-time activity feed.',
    icon: LayoutDashboard,
    gradient: 'from-blue-600 to-cyan-600',
    href: '/dashboard',
    actionLabel: 'Open Dashboard',
    highlight: 'Real-time stats + 8-metric overview grid',
    features: ['Document pipeline tracker', 'Status distribution chart', 'Recent activity feed', 'Instant search across files'],
  },
  {
    number: 2,
    title: 'Upload & OCR Extraction',
    subtitle: 'AI Document Intelligence',
    description: 'Drag-and-drop a legacy PDF or scanned deed. Watch the AI pipeline run in real-time: image enhancement → multi-language OCR → 14-field structured extraction.',
    icon: Upload,
    gradient: 'from-violet-600 to-purple-600',
    href: '/upload',
    actionLabel: 'Upload a Document',
    highlight: '22 Indian languages · 14 extracted fields',
    features: ['OpenCV image pre-processing', 'Multi-lingual Tesseract OCR', 'Auto-structured field extraction', 'Instant pipeline progress feedback'],
  },
  {
    number: 3,
    title: 'AI Verification Workbench',
    subtitle: 'Evidence-Linked Review',
    description: 'Side-by-side view of the original scanned document and extracted data. Click any field to highlight its exact bounding box on the source image. AI Agent explains every flag.',
    icon: CheckSquare,
    gradient: 'from-amber-500 to-orange-500',
    href: '/verify',
    actionLabel: 'Open Verify Records',
    highlight: 'Evidence bounding boxes · AI explanations',
    features: ['Source document preview', 'Field confidence scores', 'Inline field correction', 'AI chat agent sidebar'],
  },
  {
    number: 4,
    title: 'Mutation Workbench',
    subtitle: 'The X-Factor — Green Channel Auto-Mutation',
    description: 'The most powerful feature. Review pending land mutations with a 30-year chain-of-title timeline. AI recommends approval confidence. One-click generates an immutable blockchain hash.',
    icon: ShieldCheck,
    gradient: 'from-emerald-500 to-teal-600',
    href: '/mutation',
    actionLabel: 'Open Mutation Workbench',
    highlight: 'Blockchain SHA-256 · Chain of Title · AI confidence',
    features: ['AI approval recommendation', '30-year chain-of-title', 'One-click digital signature (DSC)', 'Immutable blockchain hash generated'],
  },
  {
    number: 5,
    title: 'GIS Parcel Map',
    subtitle: 'Spatial Boundary Intelligence',
    description: 'Every land record linked to a real satellite map polygon. PostGIS calculates geometric area and cross-checks it against the text. Boundary overlaps are flagged automatically.',
    icon: Map,
    gradient: 'from-green-600 to-emerald-600',
    href: '/map',
    actionLabel: 'Open GIS Map',
    highlight: 'PostGIS spatial mismatch detection',
    features: ['Google Maps satellite view', 'Parcel polygon overlays', 'Area mismatch detection', 'Survey number geo-linking'],
  },
  {
    number: 6,
    title: 'AI Land Intelligence Agent',
    subtitle: 'Powered by Google Gemini API',
    description: 'Ask the AI agent anything about the land records in plain English or Hindi. It explains validation flags, summarizes confidence scores, and guides officers through complex cases.',
    icon: Bot,
    gradient: 'from-purple-600 to-pink-600',
    href: '/agent',
    actionLabel: 'Chat with AI Agent',
    highlight: 'Gemini API · Multi-turn conversation',
    features: ['Why was this record flagged?', 'Show boundary discrepancies', 'Explain blockchain hash', 'Guide through mutation process'],
  },
  {
    number: 7,
    title: 'Citizen Self-Service Portal',
    subtitle: 'Zero Office Visits · 100% Transparent',
    description: 'Public-facing portal — no login required. Citizens search land records by Survey No or Owner Name, download their Record of Rights (RoR), and view the Encumbrance Certificate.',
    icon: Users,
    gradient: 'from-rose-500 to-pink-600',
    href: '/citizen',
    actionLabel: 'Open Citizen Portal',
    highlight: 'Public access · RoR download · Voice search',
    features: ['Search in 5 Indian languages', 'Download RoR & EC instantly', 'Bhashini voice search (coming)', 'Blockchain verification badge'],
  },
  {
    number: 8,
    title: 'Immutable Audit Trail',
    subtitle: 'Blockchain-Anchored Tamper-Proof Logs',
    description: 'Every action — from upload to approval — is cryptographically logged. If a corrupt official alters a record, the hash breaks instantly. Complete transparency for citizens and courts.',
    icon: Shield,
    gradient: 'from-slate-600 to-slate-800',
    href: '/audit',
    actionLabel: 'View Audit Trail',
    highlight: 'SHA-256 hash chain · Tamper detection',
    features: ['Every action logged with timestamp', 'Officer identity attribution', 'SHA-256 tamper detection', 'Export for court submissions'],
  },
];

const TECH_STACK = [
  { cat: 'Frontend', items: ['Next.js 16', 'React 19', 'Tailwind CSS v4', 'TypeScript'] },
  { cat: 'Backend', items: ['Python 3.10', 'FastAPI', 'SQLAlchemy', 'JWT Auth'] },
  { cat: 'AI & ML', items: ['Google Gemini API', 'Tesseract OCR', 'OpenCV', 'LangChain'] },
  { cat: 'Database & Geo', items: ['PostgreSQL', 'PostGIS', 'SQLite', 'GeoJSON'] },
  { cat: 'Security', items: ['SHA-256 Hashing', 'Bcrypt', 'RBAC', 'HTTPS-ready'] },
  { cat: 'Integrations', items: ['Google Maps API', 'Bhashini API', 'NIC GovCloud-ready', 'PWA Offline'] },
];

export default function DemoPage() {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5">
              <Play size={12} className="text-emerald-400" />
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Live Demo Guide</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5">
              <Star size={12} className="text-amber-400" />
              <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">SIH 2026 Submission</span>
            </div>
          </div>

          <h1 className="text-4xl font-black text-white mb-3 leading-tight">
            BhoomiAI — Complete Feature Walkthrough
          </h1>
          <p className="text-slate-300 text-lg max-w-3xl mb-8">
            Follow this guided tour to see every feature of the Intelligent Land Record Digitization & Validation System.
            All 8 modules work together end-to-end.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: '8 Modules', sub: 'Complete pipeline', icon: Zap },
              { label: '14 Fields', sub: 'AI extracted per record', icon: FileText },
              { label: '22 Languages', sub: 'Bhashini integrated', icon: Globe },
              { label: 'Blockchain', sub: 'SHA-256 audit trail', icon: Hash },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur border border-white/10 rounded-2xl p-4">
                <s.icon size={18} className="text-emerald-400 mb-2" />
                <p className="text-white font-bold text-lg leading-none">{s.label}</p>
                <p className="text-slate-400 text-xs mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Steps */}
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Sparkles size={18} className="text-emerald-500" />
          Complete Demo Steps (Click to explore)
        </h2>

        <div className="space-y-4 mb-12">
          {STEPS.map(step => {
            const Icon = step.icon;
            const isOpen = activeStep === step.number;
            return (
              <div
                key={step.number}
                className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isOpen ? 'border-emerald-300 shadow-lg shadow-emerald-500/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header row */}
                <button
                  className="w-full text-left px-5 py-4 flex items-center gap-4"
                  onClick={() => setActiveStep(isOpen ? null : step.number)}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step {step.number}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-semibold text-slate-500">{step.subtitle}</span>
                    </div>
                    <p className="text-slate-900 font-bold text-base">{step.title}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="hidden sm:inline text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      {step.highlight}
                    </span>
                    <ChevronRight size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-slate-600 text-sm leading-relaxed mb-4">{step.description}</p>
                      <ul className="space-y-2">
                        {step.features.map(f => (
                          <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col justify-between">
                      <div className={`bg-gradient-to-br ${step.gradient} rounded-xl p-4 text-white`}>
                        <p className="font-bold text-sm mb-1">{step.subtitle}</p>
                        <p className="text-white/80 text-xs">{step.highlight}</p>
                      </div>
                      <Link
                        href={step.href}
                        target={step.href === '/citizen' ? '_blank' : undefined}
                        className="mt-4 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-all"
                      >
                        {step.actionLabel}
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tech Stack */}
        <div className="bg-slate-900 rounded-3xl p-8 mb-8">
          <h2 className="text-white font-black text-xl mb-2 flex items-center gap-2">
            <Zap size={18} className="text-emerald-400" />
            Differentiated Technology Stack
          </h2>
          <p className="text-slate-400 text-sm mb-6">Every tool was chosen for a specific reason — not just generic defaults.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {TECH_STACK.map(t => (
              <div key={t.cat} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest mb-3">{t.cat}</p>
                <ul className="space-y-1">
                  {t.items.map(item => (
                    <li key={item} className="text-slate-300 text-sm flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Judge CTA */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-8 text-center">
          <Flag size={32} className="text-emerald-500 mx-auto mb-3" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Ready to see it in action?</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-lg mx-auto">
            Start from Step 1 and follow the guided tour. Each step links directly to the live feature.
            Login with <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">admin@bhoomi.gov.in</span> / <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">password</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20">
              <Play size={16} /> Start Demo Tour
            </Link>
            <Link href="/citizen" target="_blank" className="flex items-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold px-6 py-3 rounded-xl transition-all">
              <Users size={16} /> View Public Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
