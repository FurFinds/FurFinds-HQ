"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import type { HqRole } from "@/lib/types/database";

export async function updateStaffRole(id: string, role: HqRole) {
  const { profile } = await requireProfile();
  if (profile.role !== "admin") {
    throw new Error("Only admins can change staff roles.");
  }

  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/team");
}
