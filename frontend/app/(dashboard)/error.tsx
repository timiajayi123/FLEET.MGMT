'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);

  return (
    <section className="error-state">
      <div className="error-icon">
        <AlertTriangle size={30} />
      </div>
      <h1>We couldn’t load this workspace</h1>
      <p>The service encountered an unexpected problem. Your data has not been changed.</p>
      <button onClick={reset}>
        <RotateCcw size={17} /> Try again
      </button>
    </section>
  );
}
