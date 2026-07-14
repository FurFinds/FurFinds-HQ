"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateSiteSetting } from "@/app/hq/operations/actions";
import { cropToSquareJpeg, resizeToPng } from "@/lib/image";
import { Button } from "@/components/ui/Button";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { HqRole } from "@/lib/types/database";

interface SiteImageUploaderProps {
  label: string;
  description: string;
  settingKey: string;
  storageFolder: string;
  /** "photo" center-crops to a square JPEG (headshots); "logo" preserves
   * aspect ratio and transparency as a PNG (marks/wordmarks). */
  kind: "photo" | "logo";
  initialUrl: string | null;
  canEdit: boolean;
  role: HqRole;
}

export function SiteImageUploader({
  label,
  description,
  settingKey,
  storageFolder,
  kind,
  initialUrl,
  canEdit,
  role,
}: SiteImageUploaderProps) {
  const [savedUrl, setSavedUrl] = useState(initialUrl);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const blob =
        kind === "photo" ? await cropToSquareJpeg(file, 320, 0.85) : await resizeToPng(file, 480);
      setPendingBlob(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't process that image.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleCancel() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingBlob(null);
    setError(null);
  }

  async function handleSave() {
    if (!pendingBlob) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const ext = kind === "photo" ? "jpg" : "png";
      const path = `${storageFolder}/${settingKey}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("site-content")
        .upload(path, pendingBlob, { upsert: true, contentType: kind === "photo" ? "image/jpeg" : "image/png" });

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

      await updateSiteSetting(settingKey, { url: publicUrl });
      setSavedUrl(publicUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPendingBlob(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  const displayUrl = previewUrl ?? savedUrl;
  const previewBoxClass =
    kind === "photo"
      ? "h-20 w-20 shrink-0 overflow-hidden rounded-full bg-ff-pale-blue"
      : "h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-[repeating-conic-gradient(#f1f5f9_0%_25%,white_0%_50%)] bg-[length:12px_12px]";

  return (
    <div className="flex items-center gap-4">
      <div className={`flex items-center justify-center text-2xl ${previewBoxClass}`}>
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt={label}
            className={kind === "photo" ? "h-full w-full object-cover" : "h-full w-full object-contain p-2"}
          />
        ) : (
          "🐾"
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
        {canEdit ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              id={`${settingKey}-input`}
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => inputRef.current?.click()}
            >
              {pendingBlob ? "Choose a different file" : "Choose file"}
            </Button>
            {pendingBlob && (
              <>
                <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={handleCancel}>
                  Cancel
                </Button>
              </>
            )}
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
