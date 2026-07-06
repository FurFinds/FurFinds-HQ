"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";

function assertCanManage(role: string) {
  if (role !== "admin") {
    throw new Error("You don't have permission to manage finance records.");
  }
}

export interface ExpenseInput {
  category: string;
  description: string;
  amount_cents: number;
  expense_date: string;
}

export async function createExpense(input: ExpenseInput) {
  const { userId, profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("expenses").insert({ ...input, created_by: userId });

  if (error) throw new Error(error.message);
  revalidatePath("/hq/finance");
}

export async function deleteExpense(id: string) {
  const { profile } = await requireProfile();
  assertCanManage(profile.role);

  const supabase = createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hq/finance");
}

export async function importExpensesCsv(rows: ExpenseInput[]) {
  const { userId, profile } = await requireProfile();
  assertCanManage(profile.role);

  if (rows.length === 0) return { imported: 0 };
  if (rows.length > 500) throw new Error("CSV files are limited to 500 rows per import.");

  const supabase = createClient();
  const { error } = await supabase
    .from("expenses")
    .insert(rows.map((r) => ({ ...r, created_by: userId })));

  if (error) throw new Error(error.message);
  revalidatePath("/hq/finance");
  return { imported: rows.length };
}
