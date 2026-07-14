"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import type { Business, BusinessCategory, BusinessTier, VerificationStatus } from "@/lib/types/database";

export interface BusinessFormInput {
  name: string;
  category: BusinessCategory;
  description: string;
  tier: BusinessTier;
  verification_status: VerificationStatus;
  is_active: boolean;
  city: string;
  state: string;
  zip: string;
  address: string;
  phone: string;
  website: string;
  business_hours: string;
  pet_policy: string;
  service_animals_allowed: boolean;
  esa_policy: string;
}

function assertCanManage(role: string) {
  if (role !== "admin" && role !== "verification_manager" && role !== "support") {
    throw new Error("You don't have permission to manage businesses.");
  }
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createBusiness(input: BusinessFormInput) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  // The public site only shows businesses with a slug (see
  // public_read_active_businesses + FurFinds' getAllBusinesses filter), so
  // a business created here without one would silently never appear once
  // marked active. Generate it now rather than relying on staff to fill in
  // a slug field by hand.
  const { error } = await supabase.from("businesses").insert({
    ...input,
    slug: `${slugify(input.name)}-${crypto.randomUUID().slice(0, 8)}`,
  } satisfies Partial<Business>);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/operations");
}

export async function updateBusiness(id: string, input: BusinessFormInput) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();

  const { data: existing } = await supabase.from("businesses").select("slug").eq("id", id).single();
  const slug = existing?.slug || `${slugify(input.name)}-${id.slice(0, 8)}`;

  const { error } = await supabase
    .from("businesses")
    .update({ ...input, slug, updated_at: new Date().toISOString() } satisfies Partial<Business>)
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

export async function toggleActive(id: string, isActive: boolean) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/operations");
}
