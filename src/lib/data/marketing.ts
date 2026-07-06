import { createClient } from "@/lib/supabase/server";
import type { ContentPost } from "@/lib/types/database";

export async function getContentPosts(): Promise<ContentPost[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("content_posts")
    .select("*")
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  return data ?? [];
}
