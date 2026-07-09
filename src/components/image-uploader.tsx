"use client";

import { useState, useRef } from "react";

interface ImageUploaderProps {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  label?: string;
  accept?: string;
  maxSizeMB?: number;
}

export function ImageUploader({
  currentUrl,
  onUploaded,
  label = "Upload image",
  accept = "image/png,image/jpeg,image/webp",
  maxSizeMB = 2,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(currentUrl ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large (max ${maxSizeMB} MB)`);
      return;
    }

    // Show local preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      let data: { url?: string; error?: string };
      try {
        data = await res.json();
      } catch {
        setError(`Upload failed (${res.status} ${res.statusText})`);
        return;
      }

      if (data.url) {
        onUploaded(data.url);
        setPreview(data.url);
      } else {
        setError(data.error ?? `Upload failed (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }

  return (
    <div className="space-y-2">
      <label className="font-label-sm text-label-sm text-on-surface-variant block">{label}</label>

      {preview && (
        <div className="w-28 h-28 rounded-xl border border-outline-variant overflow-hidden bg-surface-container-low flex items-center justify-center">
          <img src={preview} alt="Preview" className="w-full h-full object-contain" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-surface-container disabled:opacity-60"
        >
          {uploading ? "Uploading…" : currentUrl ? "Change" : "Choose File"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
