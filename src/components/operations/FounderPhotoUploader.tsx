"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateSiteSetting } from "@/app/hq/operations/actions";
import { cropToSquareJpeg } from "@/lib/image";
import { Button } from "@/components/ui/Button";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { HqRole } from "@/lib/types/database";

export function FounderPhotoUploader({
  initialUrl,
  canEdit,
  role,
}: {
  initialUrl: string | null;
  canEdit: boolean;
  role: HqRole;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const cropped = await cropToSquareJpeg(file, 640, 0.85);
      const supabase = createClient();
      const path = `founder/photo-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("site-content")
        .upload(path, cropped, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes("bucket not found")) {
          throw new Error(
            'Storage bucket "site-content" doesn\'t exist yet. Run the latest supabase/schema.sql against your Supabase project (it creates the bucket and its access policies), then try again.'
          );
        }
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("site-content").getPublicUrl(path);

      await updateSiteSetting("founder_photo", { url: publicUrl });
      setUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-ff-pale-blue text-2xl">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Founder" className="h-full w-full object-cover" />
        ) : (
          "🧑‍💼"
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900">Founder photo</p>
        <p className="text-xs text-slate-500">Shown on the public FurFinds site.</p>
        {canEdit ? (
          <div className="mt-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              id="founder-photo-input"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload new photo"}
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Only Admins and Content Editors can update this — your role is {ROLE_LABELS[role]}.
          </p>
        )}
        {error && <p className="mt-1 max-w-sm text-xs text-[#b91c1c]">{error}</p>}
      </div>
    </div>
  );
}
