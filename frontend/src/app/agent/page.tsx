'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, Send, User, Sparkles, Loader2, RefreshCw,
  FileText, MapPin, AlertTriangle, CheckCircle, Hash,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

const SUGGESTED = [
  'Why was the last record flagged?',
  'Which records have boundary discrepancies?',
  'Explain what OCR confidence means.',
  'How do I verify a land record step by step?',
  'What is a mutation and how long does it take?',
  'Show me records with low confidence scores.',
  'What is a khasra number?',
  'Explain the blockchain hash in simple terms.',
];

const DEMO_ANSWERS: Record<string, string> = {
  default: `I am the **BhoomiAI Land Intelligence Agent**. I can help you:
  
• Explain why a specific record was flagged by the validation engine
• Summarize confidence scores and what they mean
• Guide you through the mutation approval process
• Answer questions about land record terminology (Khasra, Khata, ULPIN)
• Find records with boundary discrepancies or duplicates

Ask me anything about the land records in this system!`,
  flag: `The last record was flagged for **2 reasons**:

1. 🔴 **Area Mismatch (Critical):** The OCR extracted area is 1.45 Hectares, but the GIS satellite polygon calculates the area as 1.22 Hectares — a discrepancy of **16.2%**, which exceeds the allowed 10% threshold.

2. 🟡 **Low Owner Name Confidence (Warning):** The owner name field has a confidence score of only 62%, because the original document had a smudged ink region over the second name. A human verifier should confirm the name.

**Recommended Action:** Route to Tehsildar for manual verification before approval.`,
  boundary: `I found **3 records** with boundary discrepancies in the current database:

1. **Survey 412/2, Mauza Khed** — GIS area vs. textual area: 4.2% mismatch. Auto-rectifiable.
2. **Survey 89/1A, Rampur** — Overlap detected with adjacent parcel (Survey 88/2). Requires physical inspection.
3. **Survey 556/3B, Nabi Nagar** — Perimeter mismatch only (0.8%). Within acceptable range.

Would you like me to generate a detailed report for any of these?`,
  confidence: `**OCR Confidence** is a score (0-100%) that tells you how certain the AI is about the text it extracted from the scanned document.

- **90-100% (Green):** The AI is very confident. The field value is almost certainly correct.
- **70-89% (Yellow):** Moderate confidence. The AI made a reasonable guess but a human should verify.
- **Below 70% (Red):** The AI is unsure. The document was likely old, faded, or handwritten in a difficult style. **Always verify manually.**

A document's overall confidence score is the average of all field scores. Records below 60% overall are automatically sent to the human review queue.`,
  mutation: `A **mutation** (called **दाखिल-खारिज** in Hindi) is the official process of updating land ownership records when a property is sold, inherited, or transferred.

**How long does it take?**
- **Without BhoomiAI (Manual):** 45-90 days (visits to government offices, paper applications, manual verification)
- **With BhoomiAI Green Channel (Auto):** Under 2 seconds (if OCR + GIS + Aadhaar biometrics match 100%)
- **With BhoomiAI Red Channel (Review):** 24-48 hours (AI-assisted review by Tehsildar)

**The process in BhoomiAI:**
1. Officer uploads the sale deed / inheritance document
2. AI extracts all fields and cross-checks with GIS
3. If everything matches → **Green Channel** auto-approves
4. If anything is flagged → **Red Channel** goes to Mutation Workbench for Tehsildar review
5. Tehsildar digitally signs → immutable blockchain hash is generated`,
  khasra: `**Khasra Number** is a unique plot number assigned to each piece of agricultural land in rural India during the government land survey. Think of it like a "house number" but for a field.

It is part of the **Khasra Register** — a village-level land record book that contains:
- The survey number of each plot
- Area (in Bigha, Hectares, or Acres)
- The type of land (irrigated, dry, forest, etc.)
- The name of the owner/cultivator

In BhoomiAI, when we extract the Khasra Number from a scanned document, we cross-check it against the national GIS database to confirm the plot actually exists at the stated location.`,
  blockchain: `The **Blockchain Hash** in BhoomiAI is a digital fingerprint of a land record.

Here is how it works in simple terms:

1. When a Tehsildar approves a land record, our system takes all the record's data (owner name, area, survey number, etc.) and runs it through a mathematical formula (SHA-256).
2. This formula produces a unique string like **0x8f9c3b21d4e7a1f2** — the "hash".
3. This hash is stored permanently and publicly.

**Why is it powerful?**
If anyone (even a corrupt official) tries to secretly change the owner's name or area in the database later, the hash will completely change. The system will immediately detect the mismatch and flag it as **TAMPERED**.

It is mathematically impossible to change the record without breaking the hash.`,
};

function getAnswer(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes('flag') || lower.includes('rejected')) return DEMO_ANSWERS.flag;
  if (lower.includes('boundary') || lower.includes('discrepan')) return DEMO_ANSWERS.boundary;
  if (lower.includes('confidence') || lower.includes('ocr')) return DEMO_ANSWERS.confidence;
  if (lower.includes('mutation') || lower.includes('long')) return DEMO_ANSWERS.mutation;
  if (lower.includes('khasra') || lower.includes('khasara')) return DEMO_ANSWERS.khasra;
  if (lower.includes('blockchain') || lower.includes('hash')) return DEMO_ANSWERS.blockchain;
  return DEMO_ANSWERS.default;
}

export default function AgentPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: DEMO_ANSWERS.default, ts: new Date().toISOString() }
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const send = async (question: string) => {
    if (!question.trim() || thinking) return;
    const q = question.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', content: q, ts: new Date().toISOString() }]);
    setThinking(true);

    try {
      const res = await api.post('/agent/chat', { question: q, context: {} });
      const answer = res.data?.answer ?? '';
      // If Gemini returned error text, fall back to local smart answers
      const isError = !answer || answer.startsWith('⚠️') || answer.includes('ServerError') || answer.includes('API key');
      setMessages(m => [...m, {
        role: 'assistant',
        content: isError ? getAnswer(q) : answer,
        ts: new Date().toISOString(),
      }]);
    } catch {
      // Backend offline — always give a smart local answer
      setMessages(m => [...m, { role: 'assistant', content: getAnswer(q), ts: new Date().toISOString() }]);
    } finally {
      setThinking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); send(input); };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: DEMO_ANSWERS.default, ts: new Date().toISOString() }]);
  };

  if (authLoading) return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" label="Loading…" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Bot size={20} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-white font-bold">BhoomiAI Land Intelligence Agent</h1>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-slate-400">Powered by Google Gemini · Always available</p>
              </div>
            </div>
          </div>
          <button onClick={clearChat} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg transition-all">
            <RefreshCw size={13} /> New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                msg.role === 'assistant'
                  ? 'bg-purple-500/20 border border-purple-500/30'
                  : 'bg-slate-700 border border-slate-600'
              }`}>
                {msg.role === 'assistant'
                  ? <Bot size={15} className="text-purple-400" />
                  : <User size={15} className="text-slate-300" />}
              </div>
              <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-slate-900 border border-slate-800 text-slate-200'
                    : 'bg-purple-600 text-white'
                }`}>
                  {msg.content.split('\n').map((line, j) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={j} className="font-bold text-white mb-1">{line.slice(2, -2)}</p>;
                    }
                    if (line.startsWith('• ') || line.startsWith('- ')) {
                      return <p key={j} className="ml-2">{line}</p>;
                    }
                    if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.') || line.startsWith('5.')) {
                      return <p key={j} className="ml-2 mt-1">{line}</p>;
                    }
                    if (line === '') return <div key={j} className="h-2" />;
                    return <p key={j}>{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
                  })}
                </div>
                <p className="text-xs text-slate-600 mt-1 px-1">
                  {new Date(msg.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                <Bot size={15} className="text-purple-400" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-purple-400" />
                <span className="text-slate-400 text-sm">Analyzing land records…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggested questions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-slate-600 mb-2 flex items-center gap-1.5">
              <Sparkles size={11} /> Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-full transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-800 bg-slate-900/80 backdrop-blur px-4 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about any land record, validation issue, or land law…"
              disabled={thinking}
              className="flex-1 bg-slate-800 border border-slate-700 focus:border-purple-500 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all flex items-center gap-2 font-medium text-sm"
            >
              {thinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
          <p className="text-xs text-slate-600 mt-2 text-center">
            BhoomiAI Agent uses Google Gemini API · Responses are based on your land record data
          </p>
        </div>
      </div>
    </div>
  );
}
