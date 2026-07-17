import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="standalone-state">
      <span>404</span>
      <h1>Page not found</h1>
      <p>The page may have moved or is not available for your role.</p>
      <Link href="/dashboard">
        <ArrowLeft size={17} /> Return to dashboard
      </Link>
    </main>
  );
}
