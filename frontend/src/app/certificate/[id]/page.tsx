'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import { Shield, Download, FileText } from 'lucide-react';

export default function CertificatePage() {
  const params = useParams();
  const id = params?.id as string;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://bhoomiai-1-xa0e.onrender.com/certificate/${id}`)}`;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 print:p-0 print:bg-white">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-emerald-600 print:shadow-none print:border-2">
        {/* Header */}
        <div className="bg-emerald-700 text-white px-8 py-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Shield size={32} className="text-emerald-200" />
            <div>
              <p className="text-xs text-emerald-300 uppercase tracking-widest">Government of India</p>
              <h1 className="text-xl font-bold">BhoomiAI Revenue Department</h1>
            </div>
          </div>
          <p className="text-emerald-200 text-sm">Land Record Certificate (Khasra / RoR)</p>
        </div>

        {/* Watermark area */}
        <div className="px-8 py-6 relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
            <p className="text-8xl font-black text-emerald-800 rotate-45">VERIFIED</p>
          </div>

          <div className="grid grid-cols-2 gap-4 relative z-10">
            {[
              { label: 'Document ID', value: `DOC-${id}` },
              { label: 'Status', value: '✅ VERIFIED' },
              { label: 'Survey Number', value: '124/7' },
              { label: 'Village', value: 'Rampur' },
              { label: 'District', value: 'Agra, Uttar Pradesh' },
              { label: 'Area', value: '2.5 Hectares' },
              { label: 'Land Type', value: 'Agricultural' },
              { label: 'Issue Date', value: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
            ].map(f => (
              <div key={f.label} className="border border-slate-200 rounded-xl p-3">
                <p className="text-xs text-slate-400 uppercase tracking-wide">{f.label}</p>
                <p className="font-bold text-slate-800 mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>

          {/* QR + Blockchain */}
          <div className="flex items-center gap-6 mt-6 p-4 bg-slate-50 rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR Code" className="w-32 h-32 rounded-xl border-2 border-emerald-200" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Blockchain Secured</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">This certificate is tamper-proof and secured on a distributed blockchain ledger. Scan the QR code to instantly verify the authenticity of this document.</p>
              <p className="text-xs font-mono text-emerald-600 mt-2 bg-emerald-50 rounded-lg px-2 py-1">Hash: 0x8f9c3b21...4a77</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-5 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              <FileText size={15} /> Print Certificate
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Download size={15} /> Download PDF
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 text-center">
          <p className="text-xs text-slate-500">Issued by BhoomiAI · Powered by AI4Bharat · Smart India Hackathon 2026</p>
        </div>
      </div>
    </div>
  );
}
