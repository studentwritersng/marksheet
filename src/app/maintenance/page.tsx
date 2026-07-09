import Link from "next/link";

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#002046]/10">
            <span className="material-symbols-outlined text-4xl text-[#002046]" style={{ fontVariationSettings: "'FILL' 1" }}>
              engineering
            </span>
          </div>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">Under Maintenance</h1>
        <p className="mt-3 font-body-md text-body-md text-on-surface-variant leading-relaxed">
          We are currently performing scheduled maintenance on the portal. 
          It will be back shortly. Thank you for your patience.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-[#002046] px-6 py-2.5 font-label-md text-label-md text-white hover:bg-[#003366] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}
