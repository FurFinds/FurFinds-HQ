"use client";

import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseCsv, toCsvValue } from "@/lib/csv";
import { createExpense, deleteExpense, importExpensesCsv, type ExpenseInput } from "@/app/hq/finance/actions";
import type { Expense } from "@/lib/types/database";

const emptyForm = {
  category: "",
  description: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
};

export function ExpenseBoard({ expenses, canManage }: { expenses: Expense[]; canManage: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createExpense({
        category: form.category,
        description: form.description,
        amount_cents: Math.round(parseFloat(form.amount || "0") * 100),
        expense_date: form.expense_date,
      });
      setForm(emptyForm);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const header = ["category", "description", "amount", "expense_date"];
    const lines = [header.join(",")];
    for (const e of expenses) {
      lines.push(
        [
          toCsvValue(e.category),
          toCsvValue(e.description ?? ""),
          toCsvValue((e.amount_cents / 100).toFixed(2)),
          toCsvValue(e.expense_date),
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `furfinds-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage(null);

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const [header, ...body] = rows;
      const colIndex = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);

      const categoryIdx = colIndex("category");
      const descriptionIdx = colIndex("description");
      const amountIdx = colIndex("amount");
      const dateIdx = colIndex("expense_date");

      if (categoryIdx === -1 || amountIdx === -1 || dateIdx === -1) {
        setImportMessage("CSV must include category, amount, and expense_date columns.");
        return;
      }

      const parsed: ExpenseInput[] = body.map((row) => ({
        category: row[categoryIdx] ?? "Uncategorized",
        description: descriptionIdx >= 0 ? row[descriptionIdx] ?? "" : "",
        amount_cents: Math.round(parseFloat(row[amountIdx] ?? "0") * 100),
        expense_date: row[dateIdx] ?? new Date().toISOString().slice(0, 10),
      }));

      const result = await importExpensesCsv(parsed);
      setImportMessage(`Imported ${result.imported} expenses.`);
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={handleExport}>
          Export CSV
        </Button>
        {canManage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImport}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Import CSV
            </Button>
            <Button className="ml-auto" onClick={() => setModalOpen(true)}>
              + Add expense
            </Button>
          </>
        )}
      </div>
      {importMessage && <p className="text-sm text-slate-600">{importMessage}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Date</th>
              {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-900">{expense.category}</td>
                <td className="px-4 py-3 text-slate-600">{expense.description || "—"}</td>
                <td className="px-4 py-3 text-slate-900">{formatCurrency(expense.amount_cents)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(expense.expense_date)}</td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-xs font-medium text-ff-error hover:underline"
                      onClick={() => startTransition(() => deleteExpense(expense.id))}
                      disabled={isPending}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              required
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Software, Payroll, Marketing…"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="expense_date">Date</Label>
              <Input
                id="expense_date"
                type="date"
                required
                value={form.expense_date}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add expense"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
