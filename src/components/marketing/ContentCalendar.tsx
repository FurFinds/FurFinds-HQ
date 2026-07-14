"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type CalendarEventInput,
} from "@/app/hq/marketing/actions";
import type { CalendarEvent, CalendarEventType } from "@/lib/types/database";

const TYPE_TONE: Record<CalendarEventType, "info" | "warning" | "error" | "neutral"> = {
  social_post: "info",
  meeting: "neutral",
  deadline: "error",
  other: "warning",
};

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

const emptyForm: CalendarEventInput = {
  title: "",
  date: "",
  time: "",
  description: "",
  type: "other",
};

export function ContentCalendar({ events }: { events: CalendarEvent[] }) {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CalendarEventInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  function openNew(date: Date) {
    setEditingId(null);
    setForm({ ...emptyForm, date: toDateKey(date) });
    setModalOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditingId(event.id);
    setForm({
      title: event.title,
      date: event.date,
      time: event.time ?? "",
      description: event.description ?? "",
      type: event.type,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateCalendarEvent(editingId, form);
      } else {
        await createCalendarEvent(form);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editingId) return;
    startTransition(() => deleteCalendarEvent(editingId));
    setModalOpen(false);
  }

  function shift(amount: number) {
    setCursor((c) => {
      const next = new Date(c);
      if (view === "month") next.setMonth(next.getMonth() + amount);
      else if (view === "week") next.setDate(next.getDate() + amount * 7);
      else next.setDate(next.getDate() + amount);
      return next;
    });
  }

  const label =
    view === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
        ? `Week of ${startOfWeek(cursor).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => shift(-1)}>
            ← Prev
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold text-slate-900">{label}</span>
          <Button variant="secondary" size="sm" onClick={() => shift(1)}>
            Next →
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                  view === v ? "bg-ff-dark-blue text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => openNew(cursor)}>
            + Add event
          </Button>
        </div>
      </div>

      {view === "month" && (
        <MonthView cursor={cursor} eventsByDate={eventsByDate} onDayClick={openNew} onEventClick={openEdit} />
      )}
      {view === "week" && (
        <AgendaView
          days={Array.from({ length: 7 }, (_, i) => {
            const d = startOfWeek(cursor);
            d.setDate(d.getDate() + i);
            return d;
          })}
          eventsByDate={eventsByDate}
          onDayClick={openNew}
          onEventClick={openEdit}
        />
      )}
      {view === "day" && (
        <AgendaView days={[cursor]} eventsByDate={eventsByDate} onDayClick={openNew} onEventClick={openEdit} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit event" : "New event"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="ce-title">Title</Label>
            <Input
              id="ce-title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ce-date">Date</Label>
              <Input
                id="ce-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="ce-time">Time (optional)</Label>
              <Input
                id="ce-time"
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ce-type">Type</Label>
            <Select
              id="ce-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CalendarEventType }))}
            >
              <option value="social_post">Social post</option>
              <option value="meeting">Meeting</option>
              <option value="deadline">Deadline</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ce-description">Description</Label>
            <Textarea
              id="ce-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
          <div className="flex justify-between gap-2">
            {editingId ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="text-sm font-medium text-ff-error hover:underline"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function MonthView({
  cursor,
  eventsByDate,
  onDayClick,
  onEventClick,
}: {
  cursor: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = toDateKey(new Date());

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/70">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayEvents = eventsByDate.get(key) ?? [];
          return (
            <button
              key={key}
              onClick={() => onDayClick(d)}
              className={cn(
                "flex min-h-24 flex-col items-stretch gap-1 border-b border-r border-slate-100 p-1.5 text-left align-top last:border-r-0",
                !inMonth && "bg-slate-50/60 text-slate-300"
              )}
            >
              <span
                className={cn(
                  "self-start rounded-full px-1.5 text-xs",
                  key === today ? "bg-ff-dark-blue text-white" : "text-slate-500"
                )}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick(e);
                    }}
                    className="truncate rounded bg-ff-pale-blue px-1 py-0.5 text-[11px] text-ff-dark-blue hover:bg-ff-light-blue/40"
                  >
                    {e.title}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[11px] text-slate-400">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({
  days,
  eventsByDate,
  onDayClick,
  onEventClick,
}: {
  days: Date[];
  eventsByDate: Map<string, CalendarEvent[]>;
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const key = toDateKey(d);
        const dayEvents = (eventsByDate.get(key) ?? []).sort((a, b) =>
          (a.time ?? "").localeCompare(b.time ?? "")
        );
        return (
          <div key={key} className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
              <button
                onClick={() => onDayClick(d)}
                className="text-xs font-medium text-ff-dark-blue hover:underline"
              >
                + Add
              </button>
            </div>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-slate-400">No events.</p>
            ) : (
              <ul className="space-y-1.5">
                {dayEvents.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => onEventClick(e)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <span className="flex items-center gap-2">
                        {e.time && <span className="text-xs text-slate-400">{e.time}</span>}
                        {e.title}
                      </span>
                      <Badge tone={TYPE_TONE[e.type]}>{(e.type ?? "unknown").replace("_", " ")}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
