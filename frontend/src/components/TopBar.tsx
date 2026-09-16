'use client';

/**
 * TopBar — white page header bar with title, optional subtitle, and actions slot.
 *
 * Used by individual pages to communicate context. The layout wrapper
 * renders this once above each page's content area.
 */
import React from 'react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  /** Right-side slot for action buttons, badges, etc. */
  actions?: React.ReactNode;
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 flex-shrink-0 z-10">
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-slate-900 leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5 leading-tight truncate">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
