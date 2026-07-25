"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container"
    >
      Print / Save PDF
    </button>
  );
}
