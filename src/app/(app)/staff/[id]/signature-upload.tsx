"use client";

import { useState, useTransition } from "react";
import { ImageUploader } from "@/components/image-uploader";
import { updateStaffSignatureAction } from "./actions";

export function SignatureUpload({
  staffId,
  currentSignature,
}: {
  staffId: string;
  currentSignature: string | null;
}) {
  const [sigUrl, setSigUrl] = useState(currentSignature ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updateStaffSignatureAction(staffId, sigUrl);
      if (res.error) setError(res.error);
      if (res.success) setSuccess(res.success);
    });
  };

  return (
    <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-4">
      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
        Signature for Report Cards
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Upload this staff member&apos;s signature. It will appear on report cards for classes where they are the class teacher.
      </p>
      <div className="flex items-start gap-6 flex-wrap">
        <ImageUploader
          currentUrl={sigUrl}
          onUploaded={(url) => setSigUrl(url)}
          label="Class Teacher Signature"
        />
        <div className="flex items-center gap-3 pt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="bg-[#002046] text-white font-label-md text-label-md py-2 px-5 rounded-lg hover:bg-[#003366] disabled:opacity-60 transition-colors"
          >
            {pending ? "Saving…" : "Save Signature"}
          </button>
          {success && <span className="font-body-sm text-body-sm text-green-600">{success}</span>}
          {error && <span className="font-body-sm text-body-sm text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
