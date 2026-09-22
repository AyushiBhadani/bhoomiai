'use client';

/**
 * Sidebar — fixed left navigation for BhoomiAI.
 *
 * Role-Based Navigation:
 *  ADMIN    → All pages + Administration
 *  OFFICER  → Dashboard, Upload, Repository, Search, GIS Map
 *  VERIFIER → Dashboard, Verify (Pending), Audit Trail, Search
 *  DEMO     → All pages (read-mostly)
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Upload, Database, CheckSquare,
  Map, Search, ClipboardList, LogOut, Layers,
  ShieldCheck, Shield, Settings, PlayCircle, Bot, Users, Sparkles, AlertTriangle, Calculator, Link2, Building2, Globe2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[]; // which roles can see this item
  badge?: string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
  {
    href: '/upload',
    label: 'Upload Document',
    icon: <Upload size={17} />,
    roles: ['admin', 'officer'],
  },
  {
    href: '/extract',
    label: 'Smart Extraction',
    icon: <Sparkles size={17} />,
    roles: ['admin', 'officer'],
    badge: 'AI',
    badgeColor: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  },
  {
    href: '/verify',
    label: 'Verify Records',
    icon: <CheckSquare size={17} />,
    roles: ['admin', 'verifier'],
    badge: 'Pending',
    badgeColor: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  },
  {
    href: '/mutation',
    label: 'Mutation Workbench',
    icon: <ShieldCheck size={17} />,
    roles: ['admin', 'officer', 'verifier'],
    badge: 'New',
    badgeColor: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  },
  {
    href: '/repository',
    label: 'Land Repository',
    icon: <Database size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
  {
    href: '/search',
    label: 'Search Records',
    icon: <Search size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
  {
    href: '/map',
    label: 'GIS Parcel Map',
    icon: <Map size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
  {
    href: '/encumbrance',
    label: 'Encumbrance EC',
    icon: <Shield size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
  {
    href: '/chain-of-title',
    label: 'Chain of Title',
    icon: <Link2 size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
  {
    href: '/fraud',
    label: 'Fraud Alerts',
    icon: <AlertTriangle size={17} />,
    roles: ['admin'],
    badge: 'AI',
    badgeColor: 'text-red-400 bg-red-500/20 border-red-500/30',
  },
  {
    href: '/tax-calculator',
    label: 'Tax Calculator',
    icon: <Calculator size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
  {
    href: '/loan-eligibility',
    label: 'Loan Eligibility',
    icon: <Building2 size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
  {
    href: '/integrations',
    label: 'Gov Integrations',
    icon: <Globe2 size={17} />,
    roles: ['admin', 'officer', 'verifier'],
    badge: 'Live',
    badgeColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  },
  {
    href: '/audit',
    label: 'Audit Trail',
    icon: <ClipboardList size={17} />,
    roles: ['admin', 'verifier'],
  },
  {
    href: '/agent',
    label: 'AI Agent',
    icon: <Bot size={17} />,
    roles: ['admin', 'officer', 'verifier'],
    badge: 'AI',
    badgeColor: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  },
  {
    href: '/citizen',
    label: 'Citizen Portal',
    icon: <Users size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
  {
    href: '/demo',
    label: 'Demo Flow',
    icon: <PlayCircle size={17} />,
    roles: ['admin', 'officer', 'verifier'],
  },
];

const ROLE_META: Record<string, { label: string; color: string }> = {
  admin:    { label: 'Administrator',       color: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/30' },
  officer:  { label: 'Land Record Officer', color: 'text-blue-300 bg-blue-500/20 border-blue-500/30' },
  verifier: { label: 'Verifier',            color: 'text-amber-300 bg-amber-500/20 border-amber-500/30' },
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    api.get('/dashboard/stats').then(res => {
      setPendingCount(res.data?.pending_verification ?? 0);
    }).catch(() => {});
  }, []);

  const userRole = user?.role ?? 'officer';
  const roleMeta = ROLE_META[userRole] ?? ROLE_META.officer;

  const visibleNav = NAV_ITEMS.filter(
    (item) => item.roles.includes(userRole) || userRole === 'admin'
  );

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Resolve badge text — for Verify Records, show live pending count
  const resolveBadge = (item: NavItem): string | undefined => {
    if (item.href === '/verify') {
      return pendingCount > 0 ? String(pendingCount) : undefined;
    }
    return item.badge;
  };

  return (
    <aside
      className="w-64 flex-shrink-0 bg-slate-900 flex flex-col h-screen sticky top-0 overflow-hidden"
      aria-label="Main navigation"
    >
      {/* ── Brand ─────────────────────────────────────── */}
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
            <Layers size={20} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-black text-base tracking-tight leading-none">
              Bhoomi<span className="text-emerald-400">AI</span>
            </p>
            <p className="text-slate-400 text-xs mt-0.5 font-medium">
              Land Digitization System
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scroll">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest px-3 mb-2">
          Menu
        </p>
        {visibleNav.map((item) => {
          const { href, label, icon, badgeColor } = item;
          const badge = resolveBadge(item);
          const isActive =
            href === '/dashboard'
              ? pathname === '/dashboard' || pathname === '/'
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400'}`}>
                {icon}
              </span>
              <span className="flex-1">{label}</span>
              {badge && !isActive && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold border ${badgeColor ?? 'text-amber-400 bg-amber-500/20 border-amber-500/30'}`}>
                  {badge}
                </span>
              )}
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white/60" />}
            </Link>
          );
        })}

        {/* Admin-only section */}
        {userRole === 'admin' && (
          <>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest px-3 mb-2 mt-4">
              Administration
            </p>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-slate-400 hover:bg-slate-800 hover:text-white group`}
            >
              <span className="flex-shrink-0 text-slate-500 group-hover:text-emerald-400">
                <Settings size={17} />
              </span>
              System Settings
            </Link>
          </>
        )}
      </nav>

      {/* ── User info + logout ─────────────────────────── */}
      <div className="border-t border-slate-700/50 p-3">
        {user && (
          <div className="mb-2 px-3 py-2.5 rounded-lg bg-slate-800/60">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={13} className="text-emerald-400" />
              </div>
              <p className="text-white text-xs font-medium truncate flex-1">{user.email}</p>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${roleMeta.color}`}>
              {roleMeta.label}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm font-medium"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
