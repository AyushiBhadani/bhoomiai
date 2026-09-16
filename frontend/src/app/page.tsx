/**
 * Root page — redirects to /dashboard.
 * If the user is not logged in, the dashboard will redirect them to /login.
 */
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
