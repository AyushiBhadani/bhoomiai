/**
 * Root layout â€” wraps the whole app with AuthProvider, the Inter font,
 * and the client-side sidebar/layout switcher.
 *
 * Note: ClientLayout is a 'use client' component that uses usePathname()
 * to decide whether to show the sidebar, since layout.tsx itself is a
 * Server Component and cannot use client hooks directly.
 */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import ClientLayout from '@/components/ClientLayout';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BhoomiAI — Intelligent Land Record Digitization System',
  description:
    'Intelligent Land Record Digitization and Validation System for Smart India Hackathon 2026',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full">
        <AuthProvider>
          <ClientLayout>{children}</ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
