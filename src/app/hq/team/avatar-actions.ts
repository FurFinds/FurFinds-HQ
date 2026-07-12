"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";

export async function updateOwnAvatar(avatarUrl: string) {
  const { userId } = await requireProfile();

  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/hq", "layout");
}
