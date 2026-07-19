'use client';

import { useEffect } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

/**
 * Route-level error boundary.
 *
 * Before this existed, any exception thrown during render took the whole application to a
 * blank white page with no message and no way back - the user's only recourse was to guess
 * that reloading might help. A manuscript already imported would be lost either way, but at
 * least the failure is now visible and recoverable.
 *
 * Next renders this automatically when a client component subtree throws.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Kept: without it a production failure leaves no trace anywhere, since the overlay that
    // shows this in development does not exist in a real deployment.
    console.error('Unhandled error in UI:', error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Alert severity="error" title="Something went wrong" className="max-w-xl">
        <p>
          The page could not be displayed. Your work was not saved — this application does not
          keep manuscripts between requests, so you will need to import the file again.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-app-text-muted">Reference: {error.digest}</p>
        )}
      </Alert>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
