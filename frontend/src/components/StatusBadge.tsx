/**
 * Reusable status badge component.
 * Maps document/record status strings to Tailwind colour classes.
 */
import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  verified:            'bg-green-100 text-green-800 border-green-200',
  needs_verification:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'needs verification':'bg-yellow-100 text-yellow-800 border-yellow-200',
  pending:             'bg-yellow-100 text-yellow-800 border-yellow-200',
  processing:          'bg-blue-100 text-blue-800 border-blue-200',
  failed:              'bg-red-100 text-red-800 border-red-200',
  rejected:            'bg-red-100 text-red-800 border-red-200',
  approved:            'bg-green-100 text-green-800 border-green-200',
  uploaded:            'bg-gray-100 text-gray-700 border-gray-200',
  passed:              'bg-green-100 text-green-800 border-green-200',
  error:               'bg-red-100 text-red-800 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  needs_verification:  'Needs Verification',
  'needs verification':'Needs Verification',
  verified:            'Verified',
  processing:          'Processing',
  failed:              'Failed',
  rejected:            'Rejected',
  approved:            'Approved',
  uploaded:            'Uploaded',
  pending:             'Pending',
  passed:              'Passed',
  error:               'Error',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const lower = status?.toLowerCase() ?? 'unknown';
  const style = STATUS_STYLES[lower] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const label = STATUS_LABELS[lower] ?? status;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style} ${className}`}
    >
      {label}
    </span>
  );
}
