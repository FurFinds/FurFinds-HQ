"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABELS, visibleDepartments } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { cropToSquareJpeg } from "@/lib/image";
import { updateOwnAvatar } from "@/app/hq/team/avatar-actions";
import { SignOutButton } from "./SignOutButton";
import type { Profile } from "@/lib/types/database";

export function Sidebar({
  profile,
  onNavigate,
}: {
  profile: Profile;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const departments = visibleDepartments(profile.role);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const cropped = await cropToSquareJpeg(file);
      const supabase = createClient();
      const path = `${profile.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, cropped, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      await updateOwnAvatar(publicUrl);
      setAvatarUrl(publicUrl);
    } catch {
      // Sidebar avatar upload is a nice-to-have — fail quietly rather than
      // blocking navigation with an error banner in this small a surface.
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-full w-64 flex-col bg-ff-dark-blue">
      <div className="flex items-center gap-2 px-5 py-6">
        <span className="text-2xl">🐾</span>
        <div>
          <p className="text-sm font-bold leading-tight text-white">FurFinds HQ</p>
          <p className="text-[11px] leading-tight text-ff-pale-blue/70">
            Making pet-friendly mean something.
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        {departments.map((dept) => {
          const active = pathname?.startsWith(dept.href);
          return (
            <Link
              key={dept.slug}
              href={dept.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-ff-pale-blue/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <span className="text-base">{dept.icon}</span>
              {dept.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ff-gold/90 text-xs font-bold text-white"
            aria-label="Change profile picture"
            title="Change profile picture"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(profile.full_name ?? profile.email)
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {profile.full_name ?? profile.email}
            </p>
            <p className="truncate text-xs text-ff-pale-blue/70">{ROLE_LABELS[profile.role]}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
