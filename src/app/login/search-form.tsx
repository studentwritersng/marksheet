"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchSchoolsAction } from "./actions";

interface SchoolResult {
  id: string;
  name: string;
  shortcode: string | null;
  logo: string | null;
  motto: string | null;
}

export function SchoolSearchForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSearch(q: string) {
    setQuery(q);
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    if (trimmed.toLowerCase() === "marksheet") {
      setResults([]);
      setSearched(true);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const schools = await searchSchoolsAction(trimmed);
      setResults(schools);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function isMarksheet() {
    return query.trim().toLowerCase() === "marksheet";
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="school-search" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
          School Name or Shortcode
        </label>
        <input
          ref={inputRef}
          id="school-search"
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="e.g. UMS, University Model School..."
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>

      {searched && !loading && isMarksheet() && (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-on-surface-variant text-center">
            Platform administrator or proprietor?
          </p>
          <a
            href="/console/login"
            className="block w-full bg-[#0a0e1a] text-white font-label-md text-label-md py-2.5 px-4 rounded-lg text-center hover:bg-[#1a1f2e] transition-colors"
          >
            Owner Console Login
          </a>
          <a
            href="/proprietor/login"
            className="block w-full bg-[#002046] text-white font-label-md text-label-md py-2.5 px-4 rounded-lg text-center hover:bg-[#003366] transition-colors"
          >
            Proprietor Login
          </a>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {searched && !loading && !isMarksheet() && results.length === 0 && query.trim() && (
        <p className="text-center text-sm text-on-surface-variant py-4">
          No schools found matching &ldquo;{query.trim()}&rdquo;
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2 pt-1">
          {results.map((school) => (
            <button
              key={school.id}
              type="button"
              onClick={() => school.shortcode && router.push(`/login/${school.shortcode.toLowerCase()}`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0 overflow-hidden">
                {school.logo ? (
                  <img src={school.logo} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="material-symbols-outlined text-[18px] text-on-primary-container">school</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-label-md text-label-md text-on-surface truncate">{school.name}</p>
                <p className="text-xs text-on-surface-variant">Shortcode: {school.shortcode}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {!searched && (
        <p className="text-xs text-on-surface-variant text-center pt-2">
          Type your school name or shortcode above, or type &ldquo;Marksheet&rdquo; for console access.
        </p>
      )}
    </div>
  );
}
