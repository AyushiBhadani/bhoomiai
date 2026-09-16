'use client';

/**
 * Upload page.
 *
 * Features:
 *  - Drag-and-drop or click-to-browse file selection
 *  - Shows selected file name and size
 *  - POST /api/documents/upload with FormData
 *  - Animated status messages during upload
 *  - Redirects to /verify/[id] on success
 */
import React, { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  XCircle,
  X,
  Loader2,
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

type UploadStep = 'idle' | 'uploading' | 'processing' | 'ocr' | 'done' | 'error';

const STEP_LABELS: Record<UploadStep, string> = {
  idle:       '',
  uploading:  'Uploading document…',
  processing: 'Processing file…',
  ocr:        'Running OCR & AI extraction…',
  done:       'Complete! Redirecting…',
  error:      'Upload failed.',
};

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
];
const ACCEPTED_EXT = '.pdf,.jpg,.jpeg,.png,.tif,.tiff';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const acceptFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(pdf|jpe?g|png|tif{1,2})$/i)) {
      setErrorMsg('Unsupported file type. Please upload PDF, JPG, PNG, or TIFF.');
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setStep('idle');
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setErrorMsg(null);

    // Simulate multi-step progress
    setStep('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Short delay so user sees "Uploading…" message
      await new Promise((r) => setTimeout(r, 400));
      setStep('processing');

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setStep('ocr');
      await new Promise((r) => setTimeout(r, 800));

      setStep('done');
      const docId = res.data?.id ?? res.data?.document_id;
      setTimeout(() => {
        router.push(docId ? `/verify/${docId}` : '/dashboard');
      }, 800);
    } catch (err: unknown) {
      setStep('error');
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;
      setErrorMsg(
        detail
          ? String(detail)
          : axiosErr?.message?.includes('Network')
          ? 'Cannot reach the server. The backend may not be running.'
          : 'Upload failed. Please try again.'
      );
    }
  };

  const isWorking = ['uploading', 'processing', 'ocr', 'done'].includes(step);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Land Record</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a scanned land record document for OCR extraction and validation.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !isWorking && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer select-none ${
          dragging
            ? 'border-green-500 bg-green-50'
            : file
            ? 'border-green-400 bg-green-50/60'
            : 'border-gray-300 bg-white hover:border-green-400 hover:bg-green-50/40'
        } ${isWorking ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT}
          className="hidden"
          onChange={onFileChange}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <FileText size={48} className="text-green-600" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">{file.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); setStep('idle'); }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 mt-1"
            >
              <X size={13} /> Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <UploadCloud size={52} className="text-gray-300" />
            <div>
              <p className="font-medium text-gray-700">
                Drag &amp; drop a file here, or{' '}
                <span className="text-green-700 font-semibold">click to browse</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supported formats: PDF, JPG, PNG, TIFF
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status messages */}
      {step !== 'idle' && (
        <div
          className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${
            step === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : step === 'done'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          {step === 'done' ? (
            <CheckCircle size={16} />
          ) : step === 'error' ? (
            <XCircle size={16} />
          ) : (
            <Loader2 size={16} className="animate-spin" />
          )}
          <span>
            {step === 'error' && errorMsg ? errorMsg : STEP_LABELS[step]}
          </span>
        </div>
      )}

      {/* General error (pre-upload) */}
      {errorMsg && step === 'idle' && (
        <div className="mt-4 flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg text-sm">
          <XCircle size={16} />
          {errorMsg}
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!file || isWorking}
        className="mt-6 w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
      >
        {isWorking ? (
          <LoadingSpinner size="sm" />
        ) : (
          <UploadCloud size={17} />
        )}
        {isWorking ? 'Processing…' : 'Upload & Digitize'}
      </button>

      {/* Info box */}
      <div className="mt-8 bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-600">
        <h3 className="font-semibold text-gray-800 mb-2">What happens next?</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-xs">
          <li>The document is stored securely on the server.</li>
          <li>OCR and AI extraction identify key fields (owner, survey number, area, etc.).</li>
          <li>Automated validation checks flag any discrepancies.</li>
          <li>You review and approve the extracted data on the Verification page.</li>
        </ol>
      </div>
    </div>
  );
}
