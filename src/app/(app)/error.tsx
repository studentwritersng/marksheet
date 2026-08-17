"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Wire this up to your error tracker (Sentry, etc.) when available.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-6 text-center">
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2">
          Something went wrong
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-4">
          We couldn&apos;t complete that action. Please try again — if the problem
          continues, contact support and quote the reference below.
        </p>
        {error?.message && (
          <p className="text-left text-xs text-on-surface-variant bg-surface-container rounded p-2 mb-4 break-words">
            {error.message}
          </p>
        )}
        {error?.digest && (
          <p className="text-[10px] text-on-surface-variant mb-4">
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
