"use client";

import { useEffect } from "react";
import { rememberSchool, forgetSchool } from "../school-memory";

export function SchoolMemory({ shortcode }: { shortcode: string }) {
  useEffect(() => {
    rememberSchool(shortcode);
  }, [shortcode]);
  return null;
}

export function DifferentSchoolLink() {
  return (
    <div className="mt-4 text-center">
      <a
        href="/login?all=1"
        onClick={() => forgetSchool()}
        className="font-label-sm text-label-sm text-primary underline-offset-2 hover:underline"
      >
        Not your school? Search all schools
      </a>
    </div>
  );
}
