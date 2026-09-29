import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes accessible by each role
const ROLE_ROUTES: Record<string, string[]> = {
  admin: ['/dashboard', '/upload', '/extract', '/verify', '/mutation', '/repository', '/search', '/map', '/encumbrance', '/chain-of-title', '/fraud', '/tax-calculator', '/loan-eligibility', '/integrations', '/audit', '/agent', '/citizen', '/demo', '/certificate', '/admin'],
  officer: ['/dashboard', '/upload', '/extract', '/verify', '/mutation', '/repository', '/search', '/map', '/encumbrance', '/chain-of-title', '/tax-calculator', '/loan-eligibility', '/integrations', '/agent', '/citizen', '/demo', '/certificate'],
  verifier: ['/dashboard', '/verify', '/repository', '/search', '/map', '/encumbrance', '/chain-of-title', '/audit', '/agent', '/citizen'],
  citizen: ['/citizen'],
};

// Public routes — no auth needed
const PUBLIC_ROUTES = ['/login', '/citizen', '/citizen/login', '/citizen/register', '/citizen/dashboard'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and API calls
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) return NextResponse.next();
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next();

  // Read user from cookie (set at login)
  const userCookie = request.cookies.get('bhoomi_user')?.value;
  if (!userCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const user = JSON.parse(decodeURIComponent(userCookie));
    const role = user?.role;

    // Citizen trying to access officer pages — redirect to citizen portal
    if (role === 'citizen') {
      if (!pathname.startsWith('/citizen')) {
        return NextResponse.redirect(new URL('/citizen', request.url));
      }
      return NextResponse.next();
    }

    // Check if role has access to this route
    const allowed = ROLE_ROUTES[role] || [];
    const hasAccess = allowed.some(r => pathname.startsWith(r));
    if (!hasAccess) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)'],
};
