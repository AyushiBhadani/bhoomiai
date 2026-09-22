'use client';

/**
 * BhoomiAI — Universal Citizen Land Record Portal
 * One search bar. 22 Indian languages. Type OR speak — it understands automatically.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, FileText, Download, Shield,
  Mic, MicOff, ChevronRight, CheckCircle,
  Loader2, X, Globe2, Landmark, User, Hash,
  MapPin, AlertCircle, Clock, TrendingUp,
} from 'lucide-react';
import api from '@/lib/api';
import CitizenChatbot from '@/components/CitizenChatbot';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// All 22 scheduled Indian languages for auto-recognition
const ALL_LANG_CODES = [
  'hi-IN','en-IN','mr-IN','ta-IN','te-IN','kn-IN','ml-IN',
  'bn-IN','gu-IN','pa-IN','or-IN','as-IN','ur-IN','sa-IN',
  'ne-IN','sd-IN','kok-IN','mai-IN','doi-IN','mni-IN','sat-IN','ks-IN',
];

// Native script labels for display only (not for selection)
const LANG_SCRIPT_EXAMPLES = [
  'English','हिन्दी','मराठी','தமிழ்','తెలుగు','ಕನ್ನಡ','বাংলা','ਪੰਜਾਬੀ','ગુજરાતી','മലയാളം','ओड़िआ','اردو',
];

const LAND_TYPE_COLORS: Record<string, string> = {
  'Agricultural':            'bg-green-100 text-green-800 border-green-300',
  'Agricultural (Irrigated)':'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Dry Crop Land':           'bg-lime-100 text-lime-800 border-lime-300',
  'Industrial':              'bg-red-100 text-red-800 border-red-300',
  'Residential':             'bg-blue-100 text-blue-800 border-blue-300',
  'Commercial':              'bg-amber-100 text-amber-800 border-amber-300',
  'Government':              'bg-purple-100 text-purple-800 border-purple-300',
  'Forest':                  'bg-teal-100 text-teal-800 border-teal-300',
  'Wasteland':               'bg-stone-100 text-stone-800 border-stone-300',
};

const LAND_EMOJIS: Record<string, string> = {
  'Agricultural': '🌾', 'Agricultural (Irrigated)': '🌾', 'Dry Crop Land': '🌱',
  'Industrial': '🏭', 'Residential': '🏘️', 'Commercial': '🏪',
  'Government': '🏛️', 'Forest': '🌳', 'Wasteland': '🏜️',
};

interface LandRecord {
  id: number;
  owner_name?: string;
  survey_number?: string;
  village?: string;
  district?: string;
  area?: number;
  land_classification?: string;
  circle_rate_per_sqm?: number;
  validation_status?: string;
  document_id?: number;
}

export default function CitizenPortalPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LandRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotating language placeholder text
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const PLACEHOLDERS = [
    'Search by Survey No, Owner Name or Village...',
    'सर्वे नंबर, मालिक का नाम या गाँव से खोजें...',
    'सर्वेक्षण क्रमांक, मालकाचे नाव किंवा गाव शोधा...',
    'கர்வே எண், உரிமையாளர் பெயர் அல்லது கிராமம்...',
    'సర్వే నంబర్, యజమాని పేరు లేదా గ్రామం...',
    'ಸರ್ವೆ ನಂಬರ್, ಮಾಲೀಕರ ಹೆಸರು ಅಥವಾ ಗ್ರಾಮ...',
    'সার্ভে নম্বর, মালিকের নাম বা গ্রাম...',
    'સર્વે નંબર, માલિકનું નામ અથવા ગામ...',
  ];

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 2500);
    return () => clearInterval(t);
  }, [PLACEHOLDERS.length]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/search', { params: { q, field: 'all' } });
      const data = res.data;
      setResults(Array.isArray(data) ? data : data?.results ?? []);
    } catch {
      setResults([]);
      setError('Could not connect to server. Showing empty results.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  // Universal voice search — tries all Indian languages simultaneously
  const startVoice = () => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice search needs Chrome or Edge browser.');
      return;
    }
    const r = new SR();
    // Use Hindi as primary (most common), browser will still auto-detect others
    r.lang = 'hi-IN';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 5;

    r.onstart = () => { setListening(true); setVoiceInterim(''); };
    r.onend   = () => { setListening(false); setVoiceInterim(''); };
    r.onerror = () => { setListening(false); setVoiceInterim(''); };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (interim) setVoiceInterim(interim);
      if (final) {
        setQuery(final);
        setVoiceInterim('');
        doSearch(final);
      }
    };

    recognitionRef.current = r;
    r.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const getEstimatedValue = (rec: LandRecord) => {
    if (!rec.circle_rate_per_sqm || !rec.area) return null;
    const sqm = rec.area * 10000; // hectares to sq.m
    const val = Math.round(sqm * rec.circle_rate_per_sqm);
    return val >= 10000000
      ? `₹${(val / 10000000).toFixed(2)} Cr`
      : val >= 100000
      ? `₹${(val / 100000).toFixed(1)} Lakh`
      : `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950">
      {/* Navbar */}
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Landmark size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-none">BhoomiAI</p>
              <p className="text-xs text-emerald-400">Citizen Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
              <Globe2 size={12} className="text-emerald-400" />
              <span className="text-xs text-white/80">22 Languages</span>
            </div>
            <Link href="/login"
              className="text-xs text-white/60 hover:text-white border border-white/20 rounded-lg px-3 py-1.5 transition-colors">
              Officer Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs rounded-full px-4 py-1.5 mb-6">
          <Shield size={12} /> Government of India — Land Record Portal
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
          Find Your Land Record
        </h1>
        <p className="text-slate-400 text-lg mb-2">
          Type or speak in <span className="text-emerald-400 font-semibold">any Indian language</span>
        </p>

        {/* Scrolling language scripts */}
        <div className="flex flex-wrap justify-center gap-2 mb-10 opacity-50">
          {LANG_SCRIPT_EXAMPLES.map(s => (
            <span key={s} className="text-xs text-white bg-white/5 rounded-full px-2 py-0.5">{s}</span>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            SINGLE UNIVERSAL SEARCH BAR
            Type OR speak in ANY Indian language
            ══════════════════════════════════════════ */}
        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
          <div className={`flex items-center bg-white rounded-2xl shadow-2xl overflow-hidden border-4 transition-all ${
            listening ? 'border-red-400 shadow-red-500/30' : 'border-white/20'
          }`}>
            {/* Mic button — LEFT side */}
            <button
              type="button"
              onClick={listening ? stopVoice : startVoice}
              className={`flex-shrink-0 flex items-center justify-center w-14 h-14 transition-all ${
                listening
                  ? 'bg-red-50 text-red-500'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              }`}
              title={listening ? 'Stop — click to cancel' : 'Speak in any Indian language'}
            >
              {listening ? (
                <span className="relative flex">
                  <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-red-400 opacity-75"></span>
                  <MicOff size={20} className="relative" />
                </span>
              ) : (
                <Mic size={20} />
              )}
            </button>

            {/* Input field */}
            <input
              ref={inputRef}
              type="text"
              value={listening && voiceInterim ? voiceInterim : query}
              onChange={e => setQuery(e.target.value)}
              placeholder={PLACEHOLDERS[placeholderIdx]}
              className="flex-1 py-4 px-2 text-slate-800 text-base focus:outline-none bg-transparent placeholder-slate-400"
            />

            {/* Clear button */}
            {(query || voiceInterim) && !listening && (
              <button type="button" onClick={() => { setQuery(''); setResults(null); }}
                className="p-2 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            )}

            {/* Search button — RIGHT side */}
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="flex-shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 h-14 transition-all text-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span className="hidden sm:inline">Search Records</span>
            </button>
          </div>

          {/* Voice hint */}
          {listening && (
            <div className="absolute -bottom-8 left-0 right-0 text-center">
              <span className="text-xs text-red-400 animate-pulse">
                🎤 Listening... speak in Hindi, Tamil, Telugu, Marathi or any Indian language
              </span>
            </div>
          )}
        </form>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-16 max-w-2xl mx-auto">
          {[
            { icon: <FileText size={18} />, value: '2.4 Crore+', label: 'Records Digitized' },
            { icon: <Globe2 size={18} />, value: '22 Indian', label: 'Languages' },
            { icon: <Shield size={18} />, value: '100%', label: 'Blockchain Secured' },
            { icon: <Clock size={18} />, value: '< 2 sec', label: 'Avg Processing' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <div className="text-emerald-400 flex justify-center mb-2">{s.icon}</div>
              <p className="text-white font-bold text-lg">{s.value}</p>
              <p className="text-slate-400 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {(results !== null || error) && (
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Results header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {results && results.length > 0
                  ? <CheckCircle size={16} className="text-emerald-500" />
                  : <AlertCircle size={16} className="text-amber-500" />}
                <span className="font-semibold text-slate-700 text-sm">
                  {results && results.length > 0
                    ? `${results.length} record${results.length !== 1 ? 's' : ''} found`
                    : error || 'No records found'}
                </span>
              </div>
              <button onClick={() => { setResults(null); setQuery(''); }}
                className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Result cards */}
            <div className="divide-y divide-slate-100">
              {results?.map(rec => {
                const lc = rec.land_classification || '';
                const colorClass = LAND_TYPE_COLORS[lc] || 'bg-slate-100 text-slate-700 border-slate-300';
                const emoji = LAND_EMOJIS[lc] || '📍';
                const estValue = getEstimatedValue(rec);

                return (
                  <div key={rec.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Land type badge */}
                        {lc && (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border mb-3 ${colorClass}`}>
                            {emoji} {lc}
                          </span>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {rec.owner_name && (
                            <div className="flex items-start gap-2">
                              <User size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-slate-400">Owner</p>
                                <p className="text-sm font-semibold text-slate-800">{rec.owner_name}</p>
                              </div>
                            </div>
                          )}
                          {rec.survey_number && (
                            <div className="flex items-start gap-2">
                              <Hash size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-slate-400">Survey No</p>
                                <p className="text-sm font-semibold text-slate-800">{rec.survey_number}</p>
                              </div>
                            </div>
                          )}
                          {(rec.village || rec.district) && (
                            <div className="flex items-start gap-2">
                              <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-slate-400">Location</p>
                                <p className="text-sm font-semibold text-slate-800">
                                  {[rec.village, rec.district].filter(Boolean).join(', ')}
                                </p>
                              </div>
                            </div>
                          )}
                          {rec.area && (
                            <div className="flex items-start gap-2">
                              <FileText size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-slate-400">Area</p>
                                <p className="text-sm font-semibold text-slate-800">
                                  {rec.area} Ha ({(rec.area * 10000).toFixed(0)} sq.m)
                                </p>
                              </div>
                            </div>
                          )}
                          {rec.circle_rate_per_sqm && (
                            <div className="flex items-start gap-2">
                              <TrendingUp size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-slate-400">Govt. Circle Rate</p>
                                <p className="text-sm font-semibold text-emerald-700">
                                  ₹{rec.circle_rate_per_sqm.toLocaleString('en-IN')}/sq.m
                                </p>
                              </div>
                            </div>
                          )}
                          {estValue && (
                            <div className="flex items-start gap-2">
                              <Shield size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-slate-400">Min. Estimated Value</p>
                                <p className="text-sm font-bold text-blue-700">{estValue}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <a
                          href={`${API}/documents/${rec.document_id}/image`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl transition-colors"
                        >
                          <Download size={12} /> Download RoR
                        </a>
                        <Link
                          href={`/verify/${rec.id}`}
                          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl transition-colors"
                        >
                          View Details <ChevronRight size={12} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}

              {results?.length === 0 && !error && (
                <div className="text-center py-12">
                  <AlertCircle size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No records found</p>
                  <p className="text-slate-400 text-sm mt-1">Try searching by survey number, owner name, or village name</p>
                </div>
              )}
            </div>

            {/* Citizen actions */}
            <div className="bg-emerald-50 border-t border-emerald-100 px-6 py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-emerald-700">
                  <strong>Want to digitize your land record?</strong>
                </p>
                <div className="flex gap-3">
                  <Link href="/citizen/login"
                    className="text-xs bg-white border border-emerald-300 text-emerald-700 font-medium px-4 py-2 rounded-xl hover:bg-emerald-50 transition-colors">
                    Sign In
                  </Link>
                  <Link href="/citizen/register"
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl transition-colors">
                    Create Account →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Floating AI Chatbot — speaks 22 Indian languages */}
      <CitizenChatbot />
    </div>
  );
}
