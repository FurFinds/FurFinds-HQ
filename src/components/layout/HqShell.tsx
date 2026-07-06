"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { DEPARTMENTS } from "@/lib/auth/roles";
import type { Profile } from "@/lib/types/database";

export function HqShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const current = DEPARTMENTS.find((d) => pathname?.startsWith(d.href));

  return (
    <div className="flex h-screen overflow-hidden bg-ff-pale-blue">
      <div className="hidden md:block">
        <Sidebar profile={profile} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="relative z-50">
            <Sidebar profile={profile} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <button
            className="rounded-md p-2 text-ff-dark-blue hover:bg-ff-pale-blue md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M2.5 5h15M2.5 10h15M2.5 15h15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            {current && <span className="text-lg">{current.icon}</span>}
            <h1 className="text-lg font-semibold text-slate-900">
              {current?.label ?? "FurFinds HQ"}
            </h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
