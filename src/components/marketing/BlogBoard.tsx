"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import {
  createBlogPost,
  updateBlogPost,
  setBlogPostStatus,
  deleteBlogPost,
  type BlogPostInput,
} from "@/app/hq/marketing/actions";
import type { BlogCategory, BlogPost } from "@/lib/types/database";

const CATEGORIES: BlogCategory[] = [
  "Pet-Friendly Travel",
  "Business Spotlights",
  "Pet Care Tips",
  "Industry News",
];

const emptyForm: BlogPostInput = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  featured_image: "",
  category: "Industry News",
  author: "FurFinds Editorial",
};

export function BlogBoard({ posts, canManage }: { posts: BlogPost[]; canManage: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogPostInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof BlogPostInput>(key: K, value: BlogPostInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(post: BlogPost) {
    setEditingId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt ?? "",
      content: post.content,
      featured_image: post.featured_image ?? "",
      category: post.category,
      author: post.author,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateBlogPost(editingId, form);
      } else {
        await createBlogPost(form);
      }
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
          <Button onClick={openNew}>+ New post</Button>
        </div>
      )}

      <div className="space-y-2">
        {posts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            No blog posts yet.
          </p>
        )}
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-card"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{post.title}</p>
              <p className="text-xs text-slate-500">
                /{post.slug} · {post.category} ·{" "}
                {post.published_at ? formatDate(post.published_at) : "Not published"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={post.status} />
              {canManage && (
                <>
                  <button
                    className="text-xs font-medium text-ff-dark-blue hover:underline"
                    onClick={() => openEdit(post)}
                  >
                    Edit
                  </button>
                  {post.status === "draft" ? (
                    <button
                      className="text-xs font-medium text-ff-success/80 hover:underline"
                      disabled={isPending}
                      onClick={() => startTransition(() => setBlogPostStatus(post.id, "published"))}
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      className="text-xs font-medium text-slate-500 hover:underline"
                      disabled={isPending}
                      onClick={() => startTransition(() => setBlogPostStatus(post.id, "draft"))}
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    className="text-xs font-medium text-ff-error hover:underline"
                    disabled={isPending}
                    onClick={() => startTransition(() => deleteBlogPost(post.id))}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit blog post" : "New blog post"}
      >
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
          <div>
            <Label htmlFor="slug">Slug (optional — generated from title if blank)</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              placeholder="atlanta-pet-friendly-guide"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={form.category}
                onChange={(e) => update("category", e.target.value as BlogCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={form.author}
                onChange={(e) => update("author", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="featured_image">Featured image URL</Label>
            <Input
              id="featured_image"
              value={form.featured_image}
              onChange={(e) => update("featured_image", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              rows={2}
              value={form.excerpt}
              onChange={(e) => update("excerpt", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              rows={8}
              required
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              placeholder="Separate paragraphs with a blank line."
            />
          </div>
          {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Save draft"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
