"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateSiteSetting } from "@/app/hq/operations/actions";
import { Button } from "@/components/ui/Button";

export function FounderPhotoUploader({
  initialUrl,
  canEdit,
}: {
  initialUrl: string | null;
  canEdit: boolean;
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
      const supabase = createClient();
      const path = `founder/photo-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("site-content")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

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
        {canEdit && (
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
        )}
        {error && <p className="mt-1 text-xs text-[#b91c1c]">{error}</p>}
      </div>
    </div>
  );
}
