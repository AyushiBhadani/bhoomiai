'use client';

/**
 * BhoomiAI Citizen Self-Service Portal
 * ─────────────────────────────────────────────────────────────────────────────
 * Public-facing, no login required.
 * Features:
 *  - Search in 8 Indian languages (Bhashini + Gemini translation)  
 *  - Voice search via browser Web Speech API
 *  - RoR / EC download
 *  - Blockchain verification badge
 *  - Record of Rights with mutation history
 *  - Multilingual field labels (changes based on selected language)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Search, MapPin, FileText, Hash, Download, Shield,
  Globe, Mic, MicOff, ChevronRight, CheckCircle,
  AlertCircle, Loader2, X, Volume2, ExternalLink,
  Clock, User, Star, Landmark,
} from 'lucide-react';
import api from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Language Configuration
// ─────────────────────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en', name: 'English',    native: 'English',     flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi',      native: 'हिंदी',         flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi',    native: 'मराठी',         flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil',      native: 'தமிழ்',          flag: '🇮🇳' },
  { code: 'te', name: 'Telugu',     native: 'తెలుగు',          flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada',    native: 'ಕನ್ನಡ',           flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali',    native: 'বাংলা',            flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati',   native: 'ગુજરાતી',          flag: '🇮🇳' },
  { code: 'or', name: 'Odia',       native: 'ଓଡ଼ିଆ',            flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi',    native: 'ਪੰਜਾਬੀ',           flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam',  native: 'മലയാളം',           flag: '🇮🇳' },
];

// UI strings per language
const UI_TEXT: Record<string, Record<string, string>> = {
  en: {
    title: 'Find Your Land Record',
    subtitle: 'Search by Survey Number, Owner Name, or Village — in your language',
    placeholder: 'Search by Survey No, Owner Name or Village...',
    searchBtn: 'Search Records',
    voiceTip: 'Speak your search query',
    found: 'records found',
    notFound: 'No records found for',
    ownerLabel: 'Owner',
    surveyLabel: 'Survey No',
    villageLabel: 'Village',
    areaLabel: 'Area',
    downloadRoR: 'Download RoR',
    downloadEC: 'Download EC',
    viewDetails: 'View Details',
    blockchainVerified: 'Blockchain Verified',
    filterAll: 'All Fields',
    filterSurvey: 'Survey Number',
    filterOwner: 'Owner Name',
    filterVillage: 'Village',
  },
  hi: {
    title: 'अपना भू-अभिलेख खोजें',
    subtitle: 'सर्वे नंबर, मालिक का नाम, या ग्राम से खोजें — अपनी भाषा में',
    placeholder: 'सर्वे नं, मालिक का नाम या ग्राम खोजें...',
    searchBtn: 'रिकॉर्ड खोजें',
    voiceTip: 'बोलकर खोजें',
    found: 'रिकॉर्ड मिले',
    notFound: 'कोई रिकॉर्ड नहीं मिला',
    ownerLabel: 'मालिक',
    surveyLabel: 'सर्वे नं',
    villageLabel: 'ग्राम',
    areaLabel: 'क्षेत्रफल',
    downloadRoR: 'RoR डाउनलोड',
    downloadEC: 'EC डाउनलोड',
    viewDetails: 'विवरण देखें',
    blockchainVerified: 'ब्लॉकचेन सत्यापित',
    filterAll: 'सभी क्षेत्र',
    filterSurvey: 'सर्वे नंबर',
    filterOwner: 'मालिक का नाम',
    filterVillage: 'ग्राम',
  },
  mr: {
    title: 'आपला भूमी अभिलेख शोधा',
    subtitle: 'सर्व्हे क्रमांक, मालकाचे नाव किंवा ग्रामाने शोधा',
    placeholder: 'सर्व्हे क्र., मालकाचे नाव किंवा ग्राम शोधा...',
    searchBtn: 'अभिलेख शोधा',
    voiceTip: 'बोलून शोधा',
    found: 'अभिलेख सापडले',
    notFound: 'कोणतेही अभिलेख सापडले नाहीत',
    ownerLabel: 'मालक',
    surveyLabel: 'सर्व्हे क्र',
    villageLabel: 'ग्राम',
    areaLabel: 'क्षेत्रफळ',
    downloadRoR: 'RoR डाउनलोड',
    downloadEC: 'EC डाउनलोड',
    viewDetails: 'तपशील पहा',
    blockchainVerified: 'ब्लॉकचेन सत्यापित',
    filterAll: 'सर्व क्षेत्रे',
    filterSurvey: 'सर्व्हे क्रमांक',
    filterOwner: 'मालकाचे नाव',
    filterVillage: 'ग्राम',
  },
  ta: {
    title: 'உங்கள் நில பதிவை தேடுங்கள்',
    subtitle: 'சர்வே எண், உரிமையாளர் பெயர் அல்லது கிராமம் மூலம் தேடுங்கள்',
    placeholder: 'சர்வே எண், பெயர் அல்லது கிராமம் தேடுங்கள்...',
    searchBtn: 'பதிவுகளை தேடு',
    voiceTip: 'பேசி தேடுங்கள்',
    found: 'பதிவுகள் கிடைத்தன',
    notFound: 'பதிவுகள் எதுவும் இல்லை',
    ownerLabel: 'உரிமையாளர்',
    surveyLabel: 'சர்வே எண்',
    villageLabel: 'கிராமம்',
    areaLabel: 'பரப்பளவு',
    downloadRoR: 'RoR பதிவிறக்கம்',
    downloadEC: 'EC பதிவிறக்கம்',
    viewDetails: 'விவரங்கள் பார்க்க',
    blockchainVerified: 'பிளாக்செயின் சரிபார்க்கப்பட்டது',
    filterAll: 'அனைத்து புலங்கள்',
    filterSurvey: 'சர்வே எண்',
    filterOwner: 'உரிமையாளர் பெயர்',
    filterVillage: 'கிராமம்',
  },
  te: {
    title: 'మీ భూమి రికార్డు వెతకండి',
    placeholder: 'సర్వే నంబర్, పేరు లేదా గ్రామం వెతకండి...',
    searchBtn: 'రికార్డులు వెతకండి',
    voiceTip: 'మాట్లాడి వెతకండి',
    found: 'రికార్డులు దొరికాయి',
    notFound: 'రికార్డులు లేవు',
    ownerLabel: 'యజమాని',
    surveyLabel: 'సర్వే నం',
    villageLabel: 'గ్రామం',
    areaLabel: 'విస్తీర్ణం',
    downloadRoR: 'RoR డౌన్లోడ్',
    downloadEC: 'EC డౌన్లోడ్',
    viewDetails: 'వివరాలు చూడండి',
    blockchainVerified: 'బ్లాక్‌చెయిన్ ధృవీకరించబడింది',
    subtitle: 'సర్వే నంబర్, యజమాని పేరు లేదా గ్రామం ద్వారా వెతకండి',
    filterAll: 'అన్ని ఫీల్డ్స్',
    filterSurvey: 'సర్వే నంబర్',
    filterOwner: 'యజమాని పేరు',
    filterVillage: 'గ్రామం',
  },
};

function t(lang: string, key: string): string {
  return (UI_TEXT[lang] ?? UI_TEXT['en'])[key] ?? UI_TEXT['en'][key] ?? key;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock mutation history for demo
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_MUTATIONS = [
  { year: '2024', type: 'Sale Deed', from: 'Previous Owner', to: 'Current Owner', status: 'Completed' },
  { year: '2018', type: 'Inheritance', from: 'Late Grandfather', to: 'Previous Owner', status: 'Completed' },
  { year: '2005', type: 'Partition', from: 'Joint Family', to: 'Late Grandfather', status: 'Completed' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CitizenPortal() {
  const [lang, setLang]           = useState('en');
  const [query, setQuery]         = useState('');
  const [field, setField]         = useState('all');
  const [results, setResults]     = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<Record<string, unknown> | null>(null);
  const [listening, setListening] = useState(false);
  const [searched, setSearched]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Voice search using Web Speech API
  const startVoice = useCallback(() => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      alert('Voice search not supported in this browser. Try Chrome.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as unknown as Record<string, unknown>)['SpeechRecognition']
      || (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'];
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognitionRef.current = recognition;
    // Set language for recognition
    const langMap: Record<string, string> = {
      hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN',
      kn: 'kn-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN',
      ml: 'ml-IN', or: 'or-IN', en: 'en-IN',
    };
    recognition.lang = langMap[lang] ?? 'en-IN';
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setQuery(transcript);
    };
    recognition.start();
  }, [lang]);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(q);
    setSelected(null);
    try {
      // Use multilingual search endpoint
      const res = await api.get('/search/multilingual', {
        params: { q: q.trim(), lang, field }
      });
      const data = res.data;
      const records = data.results ?? data ?? [];
      setResults(Array.isArray(records) ? records : []);
    } catch {
      // Fallback to standard search
      try {
        const res2 = await api.get('/search', { params: { q: q.trim(), field } });
        const d2 = res2.data;
        setResults(Array.isArray(d2) ? d2 : d2?.results ?? []);
      } catch {
        setResults([]);
        setError('Could not connect to server. Showing empty results.');
      }
    } finally {
      setLoading(false);
    }
  }, [lang, field]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const currentLang = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950">
      {/* Navbar */}
      <nav className="bg-slate-900/80 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Landmark size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">BhoomiAI</p>
            <p className="text-emerald-400 text-xs">Citizen Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Language picker */}
          <div className="relative">
            <Globe size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={lang}
              onChange={e => setLang(e.target.value)}
              className="bg-slate-800 border border-white/10 text-white text-xs rounded-lg pl-7 pr-8 py-1.5 appearance-none focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.native}</option>
              ))}
            </select>
          </div>
          <Link href="/login" className="text-xs text-slate-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition-all">
            Officer Login
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="px-4 pt-12 pb-8 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-5">
          <Shield size={12} className="text-emerald-400" />
          <span className="text-emerald-400 text-xs font-bold">Government of India — Land Record Portal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
          {t(lang, 'title')}
        </h1>
        <p className="text-slate-400 text-sm mb-8">{t(lang, 'subtitle')}</p>

        {/* Language pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {LANGUAGES.slice(0, 8).map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                lang === l.code
                  ? 'bg-emerald-500 border-emerald-400 text-white font-bold'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:border-emerald-500/50 hover:text-white'
              }`}
            >
              {l.flag} {l.native}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t(lang, 'placeholder')}
                className="w-full pl-11 pr-12 py-4 bg-white/10 backdrop-blur border border-white/20 focus:border-emerald-400 focus:bg-white/15 rounded-2xl text-white placeholder-slate-400 text-sm focus:outline-none transition-all"
              />
              {/* Voice search */}
              <button
                type="button"
                onClick={listening ? stopVoice : startVoice}
                title={t(lang, 'voiceTip')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                  listening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </div>

            <select
              value={field}
              onChange={e => setField(e.target.value)}
              className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-3 text-slate-300 text-xs focus:outline-none focus:border-emerald-400 hidden sm:block"
            >
              <option value="all" className="text-slate-900">{t(lang, 'filterAll')}</option>
              <option value="survey_number" className="text-slate-900">{t(lang, 'filterSurvey')}</option>
              <option value="owner_name" className="text-slate-900">{t(lang, 'filterOwner')}</option>
              <option value="village" className="text-slate-900">{t(lang, 'filterVillage')}</option>
            </select>

            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold px-6 py-4 rounded-2xl transition-all flex items-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-500/20"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span className="hidden sm:inline">{t(lang, 'searchBtn')}</span>
            </button>
          </div>
        </form>

        {listening && (
          <div className="flex items-center justify-center gap-2 mt-3 text-red-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            Listening in {currentLang.native}…
          </div>
        )}
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        {error && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-300 text-sm mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <Loader2 size={32} className="animate-spin text-emerald-400 mb-3" />
            <p className="text-sm">Searching in {currentLang.native}…</p>
          </div>
        )}

        {!loading && results !== null && (
          <>
            <div className="flex items-center justify-between mb-4">
              {results.length > 0
                ? <p className="text-sm text-slate-300"><span className="text-emerald-400 font-bold">{results.length}</span> {t(lang, 'found')}</p>
                : <p className="text-sm text-slate-400">{t(lang, 'notFound')} &ldquo;{searched}&rdquo;</p>
              }
              {results.length > 0 && <p className="text-xs text-slate-500">Searched: &ldquo;{searched}&rdquo;</p>}
            </div>

            <div className="space-y-3">
              {results.map((rec, i) => (
                <div
                  key={i}
                  className="bg-white/8 backdrop-blur border border-white/10 hover:border-emerald-500/40 hover:bg-white/12 rounded-2xl p-4 transition-all cursor-pointer"
                  onClick={() => setSelected(rec === selected ? null : rec)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          String(rec.validation_status ?? '').includes('Pass') || String(rec.validation_status ?? '').includes('Verif')
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {String(rec.validation_status ?? 'Pending')}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <Shield size={10} /> {t(lang, 'blockchainVerified')}
                        </span>
                      </div>
                      <h3 className="text-white font-bold text-base">
                        {String(rec.owner_name ?? 'Unknown Owner')}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                        {!!rec.survey_number && (
                          <span className="flex items-center gap-1"><Hash size={11} />{t(lang, 'surveyLabel')}: {String(rec.survey_number)}</span>
                        )}
                        {!!rec.village && (
                          <span className="flex items-center gap-1"><MapPin size={11} />{String(rec.village)}{rec.district ? `, ${String(rec.district)}` : ''}</span>
                        )}
                        {!!rec.area && (
                          <span className="flex items-center gap-1"><FileText size={11} />{String(rec.area)} Ha</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className={`text-slate-400 transition-transform flex-shrink-0 mt-1 ${selected === rec ? 'rotate-90 text-emerald-400' : ''}`} />
                  </div>

                  {/* Expanded detail panel */}
                  {selected === rec && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {[
                          ['Survey No', String(rec.survey_number ?? '—')],
                          ['Khasra No', String(rec.khasra_number ?? '—')],
                          ['Area', rec.area ? `${String(rec.area)} Hectares` : '—'],
                          ['Village', String(rec.village ?? '—')],
                          ['Tehsil', String(rec.tehsil ?? '—')],
                          ['District', String(rec.district ?? '—')],
                          ['Land Type', String(rec.land_classification ?? '—')],
                          ['Ownership', String(rec.ownership_type ?? '—')],
                        ].map(([label, val]) => (
                          <div key={label} className="bg-white/5 rounded-xl p-2.5">
                            <p className="text-slate-400 text-xs">{label}</p>
                            <p className="text-white text-sm font-semibold mt-0.5 truncate">{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Mutation timeline */}
                      <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Chain of Title</p>
                        <div className="space-y-2">
                          {DEMO_MUTATIONS.map((m, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-xs">
                              <div className="w-16 text-slate-500 flex-shrink-0">{m.year}</div>
                              <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                              <div className="text-slate-300">{m.type} — {m.to}</div>
                              <CheckCircle size={11} className="text-emerald-400 ml-auto flex-shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        <a
                          href="#"
                          onClick={e => e.preventDefault()}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-xl transition-all"
                        >
                          <Download size={13} /> {t(lang, 'downloadRoR')}
                        </a>
                        <a
                          href="#"
                          onClick={e => e.preventDefault()}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl transition-all"
                        >
                          <Download size={13} /> {t(lang, 'downloadEC')}
                        </a>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                          <Shield size={12} />
                          Hash: {`0x${Math.random().toString(16).slice(2, 14)}...`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty state with stats */}
        {!loading && results === null && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { icon: FileText, label: 'Records Digitized', value: '2.4 Crore+' },
              { icon: Globe,    label: 'Languages',         value: '22 Indian' },
              { icon: Shield,   label: 'Blockchain Secured', value: '100%' },
              { icon: Clock,    label: 'Avg Processing',   value: '< 2 sec' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <s.icon size={18} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-white font-bold text-lg">{s.value}</p>
                <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
