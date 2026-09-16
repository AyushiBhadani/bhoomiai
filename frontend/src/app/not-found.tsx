/**
 * 404 Not Found page.
 */
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <FileQuestion size={64} className="text-gray-300 mb-6" />
      <h1 className="text-4xl font-bold text-gray-800 mb-2">404</h1>
      <h2 className="text-xl font-semibold text-gray-600 mb-4">Page Not Found</h2>
      <p className="text-gray-500 text-sm mb-8 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium text-sm transition-colors"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
