import { redirect } from "next/navigation";
import { canAccessDepartment } from "@/lib/auth/roles";
import type { Profile } from "@/lib/types/database";

export function requireDepartmentAccess(profile: Profile, slug: string) {
  if (!canAccessDepartment(profile.role, slug)) {
    redirect("/hq/dashboard");
  }
}
