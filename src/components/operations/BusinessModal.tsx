"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { createBusiness, updateBusiness, type BusinessFormInput } from "@/app/hq/operations/actions";
import type { Business } from "@/lib/types/database";

const emptyForm: BusinessFormInput = {
  name: "",
  category: "",
  description: "",
  tier: "basic",
  status: "pending",
  city: "",
  state: "",
  owner_name: "",
  owner_email: "",
  phone: "",
  website: "",
  featured: false,
};

export function BusinessModal({
  open,
  onClose,
  business,
}: {
  open: boolean;
  onClose: () => void;
  business: Business | null;
}) {
  const [form, setForm] = useState<BusinessFormInput>(business ? toFormInput(business) : emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof BusinessFormInput>(key: K, value: BusinessFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (business) {
        await updateBusiness(business.id, form);
      } else {
        await createBusiness(form);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={business ? "Edit business" : "Add business"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="Cafe, Retail, Lodging…"
            />
          </div>
          <div>
            <Label htmlFor="tier">Tier</Label>
            <Select id="tier" value={form.tier} onChange={(e) => update("tier", e.target.value as BusinessFormInput["tier"])}>
              <option value="basic">Basic</option>
              <option value="verified">Verified</option>
              <option value="premium">Premium</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" value={form.state} onChange={(e) => update("state", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => update("status", e.target.value as BusinessFormInput["status"])}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="rejected">Rejected</option>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="featured"
              type="checkbox"
              checked={form.featured}
              onChange={(e) => update("featured", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-ff-dark-blue focus:ring-ff-dark-blue"
            />
            <Label htmlFor="featured">Featured business</Label>
          </div>
          <div>
            <Label htmlFor="owner_name">Owner name</Label>
            <Input
              id="owner_name"
              value={form.owner_name}
              onChange={(e) => update("owner_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="owner_email">Owner email</Label>
            <Input
              id="owner_email"
              type="email"
              value={form.owner_email}
              onChange={(e) => update("owner_email", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-[#b91c1c]">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : business ? "Save changes" : "Add business"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function toFormInput(business: Business): BusinessFormInput {
  return {
    name: business.name,
    category: business.category ?? "",
    description: business.description ?? "",
    tier: business.tier,
    status: business.status,
    city: business.city ?? "",
    state: business.state ?? "",
    owner_name: business.owner_name ?? "",
    owner_email: business.owner_email ?? "",
    phone: business.phone ?? "",
    website: business.website ?? "",
    featured: business.featured,
  };
}
