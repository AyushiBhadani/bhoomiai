/**
 * ConfidenceBadge — shows an OCR confidence score as a colour-coded pill.
 * Handles: number (0–1 or 0–100), or string labels ("high"/"medium"/"low")
 */
import React from 'react';

interface ConfidenceBadgeProps {
  score: number | string | null | undefined;
  label?: boolean;
}

// Map string labels from Gemini/backend to numeric percentages
const STRING_MAP: Record<string, number> = {
  high: 95,
  medium: 65,
  med: 65,
  low: 25,
  gemini_enhanced: 92,
  overall: 90,
};

function normalise(score: number | string | null | undefined): number {
  if (score === null || score === undefined) return 0;
  if (typeof score === 'string') {
    // Check if it's a known label
    const mapped = STRING_MAP[score.toLowerCase()];
    if (mapped !== undefined) return mapped;
    // Try parsing as number
    const n = parseFloat(score);
    if (!isNaN(n)) return n > 1 ? n : n * 100;
    return 0;
  }
  return score > 1 ? score : score * 100;
}

export default function ConfidenceBadge({ score, label = true }: ConfidenceBadgeProps) {
  const pct = normalise(score);

  let colourClass = 'bg-red-100 text-red-700 border-red-200';
  let tier = 'Low';

  if (pct >= 80) {
    colourClass = 'bg-green-100 text-green-700 border-green-200';
    tier = 'High';
  } else if (pct >= 50) {
    colourClass = 'bg-yellow-100 text-yellow-700 border-yellow-200';
    tier = 'Med';
  }

  return (
    <span
      title={`Confidence: ${pct.toFixed(0)}%`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${colourClass}`}
    >
      {label ? `${tier} ${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`}
    </span>
  );
}

