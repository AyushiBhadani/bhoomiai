'use client';

/**
 * CitizenChatbot — floating AI assistant widget for the citizen portal.
 * Understands any Indian language. Answers land record questions using
 * the backend /api/agent/query endpoint (Gemini-powered).
 */
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Mic, MicOff } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface Message {
  role: 'user' | 'bot';
  text: string;
  time: string;
}

const QUICK_QUESTIONS = [
  'अपना 7/12 उतारा कैसे निकालें?',
  'How do I apply for mutation?',
  'ਜ਼ਮੀਨ ਦੀ ਰਜਿਸਟਰੀ ਕਿਵੇਂ ਕਰੀਏ?',
  'What documents are needed to register land?',
  'How to check encumbrance of my property?',
];

const FALLBACK_ANSWERS: Record<string, string> = {
  default: `I'm your BhoomiAI land assistant 🏛️ I can help you with:\n\n• Checking your land records & survey numbers\n• Applying for mutations (ownership transfer)\n• Understanding encumbrance certificates\n• Calculating property tax & loan eligibility\n• Downloading your RoR (Record of Rights)\n\nAsk me anything in Hindi, English, Marathi, Tamil, or any Indian language!`,
  mutation: `To apply for a **Mutation (Dakhil-Kharij)**:\n\n1. Go to your Citizen Dashboard\n2. Click **"Request Record Update / Mutation"**\n3. Select **"Ownership Transfer"**\n4. Upload your Sale Deed / Will / Gift Deed\n5. Pay the mutation fee (₹50-₹500 depending on state)\n\nThe Revenue Officer will verify and approve within 7-30 days. You'll get an SMS/email notification.`,
  '7/12': `To get your **7/12 Utara** (Satbara):\n\n1. Visit the **Citizen Portal** → Search your survey number\n2. Enter your survey number (e.g. 124/7)\n3. Click **Download RoR**\n\nOr visit your Talathi / Patwari office with:\n• Land Survey Number\n• Aadhaar Card\n• ₹20 fee\n\nOnline 7/12 is available on Maharashtra Bhulekh, AP Meebhoomi, UP Bhulekh portals.`,
  register: `**Land Registration Process:**\n\n1. Get **Market Value** from government circle rate\n2. Pay **Stamp Duty** (3-8% depending on state)\n3. Book appointment at Sub-Registrar office\n4. Bring original documents + 2 witnesses\n5. Biometric verification of both parties\n6. Get registered Sale Deed\n\nRegistration is mandatory within **4 months** of sale deed date. BhoomiAI can help digitize your registered deed instantly!`,
  encumbrance: `An **Encumbrance Certificate (EC)** shows all transactions on a property for the last 12+ years.\n\n**You need it for:**\n• Getting a bank loan against property\n• Verifying the property has no legal dues\n• Before buying any property\n\n**Get it instantly on BhoomiAI:**\n👉 Go to **Encumbrance EC** page\n👉 Enter your Survey Number\n👉 Download or print the certificate\n\nOr visit Sub-Registrar office with ₹200 fee.`,
  tax: `**Property Tax** is calculated as:\n\n**Tax = Market Value × Tax Rate**\n\nWhere:\n• Market Value = Area × Circle Rate\n• Tax Rate = 0.05% to 0.25% (varies by land type & district)\n\n**Agricultural land** has the lowest tax (0.05%)\n**Commercial land** has the highest (0.25%)\n\nUse our **Tax Calculator** to get the exact amount for your land instantly! 🧮`,
};

function getSmartReply(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('mutation') || q.includes('dakhil') || q.includes('म्यूटेशन') || q.includes('ਰਜਿਸਟਰੀ')) return FALLBACK_ANSWERS.mutation;
  if (q.includes('7/12') || q.includes('satbara') || q.includes('उतारा') || q.includes('ror') || q.includes('record')) return FALLBACK_ANSWERS['7/12'];
  if (q.includes('register') || q.includes('registr') || q.includes('stamp duty') || q.includes('sale deed')) return FALLBACK_ANSWERS.register;
  if (q.includes('encumbrance') || q.includes('ec ') || q.includes('loan') || q.includes('mortgage')) return FALLBACK_ANSWERS.encumbrance;
  if (q.includes('tax') || q.includes('टैक्स') || q.includes('ਟੈਕਸ')) return FALLBACK_ANSWERS.tax;
  return FALLBACK_ANSWERS.default;
}

function now() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function CitizenChatbot() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: FALLBACK_ANSWERS.default, time: now() },
  ]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef  = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', text: text.trim(), time: now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/agent/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, context: { page: 'citizen_portal' } }),
      });
      if (res.ok) {
        const data = await res.json();
        const answer = data.answer || data.response || getSmartReply(text);
        setMessages(prev => [...prev, { role: 'bot', text: answer, time: now() }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: getSmartReply(text), time: now() }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: getSmartReply(text), time: now() }]);
    } finally {
      setLoading(false);
    }
  };

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input needs Chrome or Edge browser.'); return; }
    const r = new SR();
    r.lang = 'hi-IN';
    r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onend   = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      sendMessage(transcript);
    };
    recogRef.current = r;
    r.start();
  };

  const stopVoice = () => { recogRef.current?.stop(); setListening(false); };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${
          open ? 'bg-slate-700 rotate-90' : 'bg-emerald-600 hover:bg-emerald-500'
        }`}
        title="Ask BhoomiAI anything"
      >
        {open ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
        {!open && messages.length === 1 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">1</span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="bg-emerald-600 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm leading-none">BhoomiAI Assistant</p>
              <p className="text-emerald-200 text-xs mt-0.5">Speaks 22 Indian languages</p>
            </div>
            <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.role === 'bot' ? 'bg-emerald-100' : 'bg-blue-100'
                }`}>
                  {m.role === 'bot' ? <Bot size={12} className="text-emerald-600" /> : <User size={12} className="text-blue-600" />}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'bot'
                    ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                    : 'bg-emerald-600 text-white rounded-br-sm'
                }`}>
                  {m.text}
                  <p className={`text-[10px] mt-1 ${m.role === 'bot' ? 'text-slate-400' : 'text-emerald-200'}`}>{m.time}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-end gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Bot size={12} className="text-emerald-600" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 bg-slate-50 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1.5">Quick questions:</p>
              <div className="flex flex-wrap gap-1">
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-left">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Ask in any language…"
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400"
            />
            <button onClick={listening ? stopVoice : startVoice}
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                listening ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
              }`}>
              {listening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
              className="w-8 h-8 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
              {loading ? <Loader2 size={13} className="text-white animate-spin" /> : <Send size={13} className="text-white" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
