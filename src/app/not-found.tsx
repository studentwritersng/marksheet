import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="mx-auto max-w-md text-center">
        <p className="font-headline-lg text-[120px] leading-none font-bold text-[#002046]/10 select-none">
          404
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-semibold -mt-4">
          Page not found
        </h1>
        <p className="mt-3 font-body-md text-body-md text-on-surface-variant leading-relaxed">
          The page you are looking for does not exist or has been moved.
          Check the URL or navigate back to a known page.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#002046] px-6 py-2.5 font-label-md text-label-md text-white hover:bg-[#003366] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Go Home
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-6 py-2.5 font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
