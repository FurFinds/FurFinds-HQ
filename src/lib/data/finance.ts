import { createClient } from "@/lib/supabase/server";
import type { Expense } from "@/lib/types/database";

export async function getExpenses(): Promise<Expense[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });
  return data ?? [];
}
