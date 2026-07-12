"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import type { BlogCategory, CalendarEventType, ContentChannel, ContentStatus } from "@/lib/types/database";

function assertCanManage(role: string) {
  if (role !== "admin" && role !== "content_editor") {
    throw new Error("You don't have permission to manage content.");
  }
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string;
  category: BlogCategory;
  author: string;
}

export async function createBlogPost(input: BlogPostInput) {
  const { userId, profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("blog_posts").insert({
    ...input,
    slug: input.slug.trim() || slugify(input.title),
    status: "draft",
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
}

export async function updateBlogPost(id: string, input: BlogPostInput) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase
    .from("blog_posts")
    .update({ ...input, slug: input.slug.trim() || slugify(input.title) })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
}

export async function setBlogPostStatus(id: string, status: "draft" | "published") {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase
    .from("blog_posts")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
}

export async function deleteBlogPost(id: string) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
}

export interface CalendarEventInput {
  title: string;
  date: string;
  time: string;
  description: string;
  type: CalendarEventType;
}

export async function createCalendarEvent(input: CalendarEventInput) {
  const { userId } = await requireProfile();

  const supabase = createClient();
  const { error } = await supabase.from("calendar_events").insert({
    ...input,
    time: input.time || null,
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
}

export async function updateCalendarEvent(id: string, input: CalendarEventInput) {
  await requireProfile();

  const supabase = createClient();
  const { error } = await supabase
    .from("calendar_events")
    .update({ ...input, time: input.time || null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
}

export async function deleteCalendarEvent(id: string) {
  await requireProfile();

  const supabase = createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/marketing");
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
