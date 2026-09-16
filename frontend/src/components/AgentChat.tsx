'use client';

/**
 * AgentChat — collapsible AI chat widget for the verification page.
 * Uses /api/agent/query for record-specific questions.
 * Falls back to smart client-side answers if backend is unavailable.
 */
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2, Sparkles } from 'lucide-react';
import api from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface AgentChatProps {
  recordId: number | null;
  surveyNumber?: string | null;
  ownerName?: string | null;
}

const SUGGESTED = [
  'Are there any validation issues?',
  'What does the confidence score mean?',
  'How do I approve this record?',
  'What is a khasra number?',
];

// Smart client-side fallback answers (no API needed)
function smartAnswer(q: string, ownerName?: string | null, surveyNumber?: string | null): string {
  const lower = q.toLowerCase();
  if (lower.includes('owner')) return `The owner of this record is **${ownerName ?? 'Not extracted'}**. If this looks incorrect, you can edit it in the Extracted Fields tab above.`;
  if (lower.includes('survey')) return `The survey number for this record is **${surveyNumber ?? 'Not extracted'}**. This is cross-checked against the national GIS parcel database.`;
  if (lower.includes('confidence') || lower.includes('score')) return '**Confidence Score** shows how certain the AI is about each extracted field.\n\n🟢 90%+ = Very confident\n🟡 70–89% = Moderate — please verify\n🔴 <70% = Uncertain — field must be manually confirmed\n\nRed-highlighted fields have validation issues that require your attention.';
  if (lower.includes('approv')) return '**To approve this record:**\n1. Review all extracted fields in the Fields tab\n2. Correct any fields highlighted in red\n3. Scroll down to the Action Bar\n4. Add an optional comment\n5. Click the green **✅ Approve** button\n\nApproval generates an immutable SHA-256 blockchain hash.';
  if (lower.includes('reject')) return '**To reject this record:**\n1. Identify the issue (wrong fields, fraudulent document, etc.)\n2. Scroll to the Action Bar at the bottom\n3. Type a clear rejection reason in the comment box\n4. Click the red **❌ Reject** button\n\nThe officer who uploaded the document will be notified.';
  if (lower.includes('khasra')) return '**Khasra Number** is a unique plot ID assigned to agricultural land during government surveys.\n\n- Part of the village Khasra Register\n- Contains plot area, land type, and owner details\n- Cross-checked against the national GIS database in BhoomiAI';
  if (lower.includes('mutation') || lower.includes('dakhil')) return '**Mutation (दाखिल-खारिज)** updates land ownership when property is sold or inherited.\n\n✅ Green Channel (auto): < 2 seconds if all fields match\n🔴 Red Channel (review): Sent to Mutation Workbench\n\nWithout BhoomiAI: 45–90 days | With BhoomiAI: 2 sec – 48 hrs';
  if (lower.includes('validation') || lower.includes('issue') || lower.includes('error')) return 'Validation issues are shown as **red-highlighted fields** in the Extracted Fields tab.\n\nCommon issues:\n- Area mismatch between OCR and GIS satellite data\n- Low confidence on owner name (smudged text)\n- Survey number not found in GIS database\n\nYou can manually correct any field by clicking on it and typing the correct value.';
  if (lower.includes('blockchain') || lower.includes('hash')) return '**Blockchain Hash** is a SHA-256 fingerprint generated when you approve a record.\n\nIf anyone modifies the database after approval, the hash changes and the system flags it as **🚨 TAMPERED**. This makes BhoomiAI records legally tamper-proof.';
  return `I can help you with this land record!\n\nTry asking:\n- *"Are there any validation issues?"*\n- *"How do I approve this record?"*\n- *"What does the confidence score mean?"*\n- *"Who is the owner of this record?"*`;
}

export default function AgentChat({ recordId, surveyNumber, ownerName }: AgentChatProps) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    text: `Hello! I'm your AI assistant for this land record. Ask me anything — validation issues, how to approve, what fields mean, etc.`,
  }]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const q = text.trim();
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/agent/query', {
        record_id: recordId,
        question: q,
      });
      const answer = res.data?.answer;
      if (answer && !answer.startsWith('⚠️') && !answer.includes('ServerError')) {
        setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
      } else {
        throw new Error('bad_response');
      }
    } catch {
      // Smart client-side fallback — never show error to user
      const fallback = smartAnswer(q, ownerName, surveyNumber);
      setMessages(prev => [...prev, { role: 'assistant', text: fallback }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ maxHeight: '480px' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles size={12} />
              </div>
              <div>
                <p className="font-bold text-sm leading-none">AI Assistant</p>
                <p className="text-emerald-200 text-xs">Powered by BhoomiAI</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-emerald-200 hover:text-white transition-colors" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                    <Bot size={12} className="text-emerald-700" />
                  </div>
                )}
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Bot size={12} className="text-emerald-700" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 flex items-center gap-1.5 shadow-sm">
                  <Loader2 size={12} className="animate-spin text-emerald-600" />
                  <span className="text-xs text-slate-400">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 pt-1 flex flex-wrap gap-1 bg-slate-50 border-t border-slate-100">
              {SUGGESTED.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full hover:bg-emerald-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-slate-100 bg-white flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50"
              placeholder="Ask about this record…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="bg-emerald-600 text-white rounded-xl px-3 py-2 hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              aria-label="Send"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(v => !v)}
        className="bg-emerald-700 hover:bg-emerald-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl transition-all hover:scale-105"
        aria-label="Toggle AI chat"
      >
        {open ? <X size={20} /> : <MessageCircle size={22} />}
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>
    </div>
  );
}
