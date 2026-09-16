'use client';

/**
 * Global navigation bar rendered inside the root layout.
 * Shows app branding on the left and user info + logout on the right.
 * Conditionally rendered: hidden on the /login page.
 */
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  LayoutDashboard,
  Upload,
  Map,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/map', label: 'Map', icon: Map },
];

const ROLE_COLOURS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  officer: 'bg-blue-100 text-blue-700',
  verifier: 'bg-yellow-100 text-yellow-700',
};

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Don't show the nav on the login page
  if (pathname === '/login') return null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const roleStyle =
    ROLE_COLOURS[user?.role ?? ''] ?? 'bg-gray-100 text-gray-700';

  return (
    <nav className="bg-green-800 text-white shadow-lg z-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link
            href="/dashboard"
            className="flex items-center gap-3 font-bold text-lg hover:text-green-200 transition-colors"
          >
            <Building2 size={24} className="text-green-300" />
            <span className="hidden sm:block">🏛️ Land Record System</span>
            <span className="sm:hidden">🏛️ LRS</span>
          </Link>

          {/* Navigation links */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? 'bg-green-900 text-white'
                        : 'text-green-100 hover:bg-green-700 hover:text-white'
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-medium text-white">
                    {user.email}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleStyle}`}
                  >
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-2 rounded-md transition-colors"
                  title="Logout"
                >
                  <LogOut size={15} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-md transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
