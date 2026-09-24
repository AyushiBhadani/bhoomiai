'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Exclude sidebar on login/auth/public routes and ALL citizen pages
  const noSidebar =
    pathname === '/login' ||
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/citizen') ||   // covers /citizen, /citizen/login, /citizen/register, /citizen/dashboard
    pathname?.startsWith('/verify-cert');  // public certificate verification
  if (noSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
      {/* Mobile Header (Only visible on small screens) */}
      <div className="lg:hidden absolute top-0 left-0 w-full h-14 bg-slate-900 flex items-center justify-between px-4 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 font-bold text-sm">B</span>
          </div>
          <span className="text-white font-bold tracking-tight">BhoomiAI</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-300 hover:text-white p-2"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto mt-14 lg:mt-0 relative">
        {children}
      </main>
    </div>
  );
}
