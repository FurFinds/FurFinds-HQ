"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import type { TicketPriority, TicketStatus, TicketType } from "@/lib/types/database";

function assertCanManage(role: string) {
  if (role !== "admin" && role !== "support") {
    throw new Error("You don't have permission to manage tickets.");
  }
}

export interface TicketInput {
  subject: string;
  message: string;
  priority: TicketPriority;
  type: TicketType;
  customer_name: string;
  customer_email: string;
}

export async function createTicket(input: TicketInput) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("support_tickets").insert({
    ...input,
    status: "open",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/hq/customer-success");
}

export async function updateTicket(
  id: string,
  updates: {
    status?: TicketStatus;
    priority?: TicketPriority;
    type?: TicketType;
    assigned_to?: string | null;
  }
) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/customer-success");
}
