"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import type { Business, BusinessStatus, BusinessTier } from "@/lib/types/database";

export interface BusinessFormInput {
  name: string;
  category: string;
  description: string;
  tier: BusinessTier;
  status: BusinessStatus;
  city: string;
  state: string;
  owner_name: string;
  owner_email: string;
  phone: string;
  website: string;
  featured: boolean;
}

function assertCanManage(role: string) {
  if (role !== "admin" && role !== "verification_manager" && role !== "support") {
    throw new Error("You don't have permission to manage businesses.");
  }
}

export async function createBusiness(input: BusinessFormInput) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("businesses").insert({
    ...input,
    rating: 0,
    review_count: 0,
  } satisfies Partial<Business>);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/operations");
}

export async function updateBusiness(id: string, input: BusinessFormInput) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ ...input, updated_at: new Date().toISOString() } satisfies Partial<Business>)
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/operations");
}

export async function deleteBusiness(id: string) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("businesses").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/operations");
}

export async function updateSiteSetting(key: string, value: Record<string, unknown>) {
  const { userId, profile } = await requireProfile();

  if (profile.role !== "admin" && profile.role !== "content_editor") {
    throw new Error("You don't have permission to update site content.");
  }

  const supabase = createClient();
  const { error } = await supabase.from("site_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/hq/operations");
}

export async function toggleFeatured(id: string, featured: boolean) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ featured, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/operations");
}
