"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { createBusiness, updateBusiness, type BusinessFormInput } from "@/app/hq/operations/actions";
import type { Business, BusinessCategory } from "@/lib/types/database";

const CATEGORIES: { value: BusinessCategory; label: string }[] = [
  { value: "restaurants", label: "Restaurants & Cafes" },
  { value: "hotels", label: "Hotels & Accommodations" },
  { value: "parks", label: "Parks & Outdoor Spaces" },
  { value: "retail", label: "Retail & Shopping" },
  { value: "groomers", label: "Groomers & Pet Services" },
  { value: "vets", label: "Veterinary & Healthcare" },
  { value: "events", label: "Events & Activities" },
  { value: "transportation", label: "Transportation" },
  { value: "other", label: "Other" },
];

const emptyForm: BusinessFormInput = {
  name: "",
  category: "other",
  description: "",
  tier: "pets_allowed",
  verification_status: "pending",
  is_active: false,
  city: "",
  state: "",
  zip: "",
  address: "",
  phone: "",
  website: "",
  business_hours: "",
  pet_policy: "",
  service_animals_allowed: true,
  esa_policy: "",
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
      <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
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
            <Select
              id="category"
              value={form.category}
              onChange={(e) => update("category", e.target.value as BusinessCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tier">Tier</Label>
            <Select
              id="tier"
              value={form.tier}
              onChange={(e) => update("tier", e.target.value as BusinessFormInput["tier"])}
            >
              <option value="pets_allowed">Pets Allowed</option>
              <option value="pet_friendly">Pet-Friendly</option>
              <option value="pet_inclusive">Pet-Inclusive</option>
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
            <Label htmlFor="zip">ZIP</Label>
            <Input id="zip" value={form.zip} onChange={(e) => update("zip", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="verification_status">Verification status</Label>
            <Select
              id="verification_status"
              value={form.verification_status}
              onChange={(e) =>
                update("verification_status", e.target.value as BusinessFormInput["verification_status"])
              }
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update("is_active", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-ff-dark-blue focus:ring-ff-dark-blue"
            />
            <Label htmlFor="is_active">Live on public site</Label>
          </div>
          <div className="col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={form.address} onChange={(e) => update("address", e.target.value)} />
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
            <Label htmlFor="business_hours">Hours</Label>
            <Input
              id="business_hours"
              value={form.business_hours}
              onChange={(e) => update("business_hours", e.target.value)}
              placeholder="Mon–Sun: 7:00 AM – 6:00 PM"
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
          <div className="col-span-2">
            <Label htmlFor="pet_policy">Pet policy</Label>
            <Textarea
              id="pet_policy"
              rows={2}
              value={form.pet_policy}
              onChange={(e) => update("pet_policy", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="service_animals_allowed"
              type="checkbox"
              checked={form.service_animals_allowed}
              onChange={(e) => update("service_animals_allowed", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-ff-dark-blue focus:ring-ff-dark-blue"
            />
            <Label htmlFor="service_animals_allowed">Service animals allowed</Label>
          </div>
          <div>
            <Label htmlFor="esa_policy">ESA policy</Label>
            <Input
              id="esa_policy"
              value={form.esa_policy}
              onChange={(e) => update("esa_policy", e.target.value)}
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
    category: business.category ?? "other",
    description: business.description ?? "",
    tier: business.tier,
    verification_status: business.verification_status,
    is_active: business.is_active,
    city: business.city ?? "",
    state: business.state ?? "",
    zip: business.zip ?? "",
    address: business.address ?? "",
    phone: business.phone ?? "",
    website: business.website ?? "",
    business_hours: business.business_hours ?? "",
    pet_policy: business.pet_policy ?? "",
    service_animals_allowed: business.service_animals_allowed ?? true,
    esa_policy: business.esa_policy ?? "",
  };
}
