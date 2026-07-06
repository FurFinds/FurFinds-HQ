"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import {
  createContentPost,
  deleteContentPost,
  updatePostStatus,
  type ContentPostInput,
} from "@/app/hq/marketing/actions";
import type { ContentPost } from "@/lib/types/database";

const CHANNEL_ICON: Record<string, string> = {
  instagram: "📷",
  facebook: "👍",
  tiktok: "🎵",
  email: "✉️",
  blog: "📝",
};

const emptyForm: ContentPostInput = {
  title: "",
  channel: "instagram",
  status: "draft",
  scheduled_at: null,
  body: "",
};

export function ContentBoard({ posts, canManage }: { posts: ContentPost[]; canManage: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ContentPostInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof ContentPostInput>(key: K, value: ContentPostInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createContentPost(form);
      setForm(emptyForm);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setModalOpen(true)}>+ New post</Button>
        </div>
      )}

      <div className="space-y-2">
        {posts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            No content scheduled yet.
          </p>
        )}
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-card"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-xl">{CHANNEL_ICON[post.channel]}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{post.title}</p>
                <p className="text-xs text-slate-500">
                  {post.scheduled_at ? formatDateTime(post.scheduled_at) : "Not scheduled"} ·{" "}
                  <span className="capitalize">{post.channel}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManage ? (
                <Select
                  value={post.status}
                  onChange={(e) =>
                    startTransition(() =>
                      updatePostStatus(post.id, e.target.value as ContentPost["status"])
                    )
                  }
                  disabled={isPending}
                  className="w-32"
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                </Select>
              ) : (
                <StatusBadge status={post.status} />
              )}
              {canManage && (
                <button
                  className="text-xs font-medium text-ff-error hover:underline"
                  onClick={() => startTransition(() => deleteContentPost(post.id))}
                  disabled={isPending}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New content post">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="channel">Channel</Label>
              <Select
                id="channel"
                value={form.channel}
                onChange={(e) => update("channel", e.target.value as ContentPostInput["channel"])}
              >
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="email">Email</option>
                <option value="blog">Blog</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={form.status}
                onChange={(e) => update("status", e.target.value as ContentPostInput["status"])}
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="scheduled_at">Scheduled for</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={form.scheduled_at ?? ""}
              onChange={(e) => update("scheduled_at", e.target.value || null)}
            />
          </div>
          <div>
            <Label htmlFor="body">Caption / copy</Label>
            <Textarea
              id="body"
              rows={4}
              value={form.body}
              onChange={(e) => update("body", e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add to calendar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function TemplateLibrary() {
  const templates = [
    {
      name: "New business spotlight",
      channel: "instagram",
      copy: "Meet {business_name} — the newest pet-friendly spot in {city}! 🐾 Tap the link to see why owners love bringing their pups here.",
    },
    {
      name: "Verified badge announcement",
      channel: "facebook",
      copy: "{business_name} just earned FurFinds Verified status ✅ — that means their pet policies are the real deal.",
    },
    {
      name: "Weekly roundup email",
      channel: "email",
      copy: "This week's top pet-friendly finds near you, hand-picked by the FurFinds team.",
    },
    {
      name: "Founder story",
      channel: "blog",
      copy: "Why we started FurFinds: making pet-friendly mean something, one verified business at a time.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {templates.map((t) => (
        <div key={t.name} className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{t.name}</p>
            <Badge tone="info">{t.channel}</Badge>
          </div>
          <p className="text-sm text-slate-600">{t.copy}</p>
        </div>
      ))}
    </div>
  );
}
