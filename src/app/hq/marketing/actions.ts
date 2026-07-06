"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import type { ContentChannel, ContentStatus } from "@/lib/types/database";

function assertCanManage(role: string) {
  if (role !== "admin" && role !== "content_editor") {
    throw new Error("You don't have permission to manage content.");
  }
}

export interface ContentPostInput {
  title: string;
  channel: ContentChannel;
  status: ContentStatus;
  scheduled_at: string | null;
  body: string;
}

export async function createContentPost(input: ContentPostInput) {
  const { userId, profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("content_posts").insert({
    ...input,
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
}

export async function updatePostStatus(id: string, status: ContentStatus) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("content_posts").update({ status }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
}

export async function deleteContentPost(id: string) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("content_posts").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
}
