/**
 * LoadingSpinner — a simple animated Tailwind spinner.
 * Accepts size and colour override via className.
 */
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const SIZE_MAP = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};

export default function LoadingSpinner({
  size = 'md',
  className = '',
  label,
}: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div
        className={`${SIZE_MAP[size]} rounded-full border-green-700 border-t-transparent animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {label && (
        <p className="text-sm text-gray-500">{label}</p>
      )}
    </div>
  );
}
