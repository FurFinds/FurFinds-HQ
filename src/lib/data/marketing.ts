import { createClient } from "@/lib/supabase/server";
import type { BlogPost, CalendarEvent, ContentPost } from "@/lib/types/database";

export async function getContentPosts(): Promise<ContentPost[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("content_posts")
    .select("*")
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  return data ?? [];
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = createClient();
  const { data } = await supabase.from("calendar_events").select("*").order("date", { ascending: true });
  return data ?? [];
}
