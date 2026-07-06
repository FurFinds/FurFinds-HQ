import type { HqRole } from "@/lib/types/database";

export const ROLE_LABELS: Record<HqRole, string> = {
  admin: "Admin",
  verification_manager: "Verification Manager",
  support: "Support",
  content_editor: "Content Editor",
  developer: "Developer",
};

export interface Department {
  slug: string;
  label: string;
  href: string;
  icon: string;
  /** Roles allowed to view this department. `admin` always has access. */
  roles: HqRole[];
}

export const DEPARTMENTS: Department[] = [
  {
    slug: "dashboard",
    label: "Command Center",
    href: "/hq/dashboard",
    icon: "🏛️",
    roles: ["admin", "verification_manager", "support", "content_editor", "developer"],
  },
  {
    slug: "marketing",
    label: "Marketing",
    href: "/hq/marketing",
    icon: "📢",
    roles: ["admin", "content_editor"],
  },
  {
    slug: "verification",
    label: "Verification",
    href: "/hq/verification",
    icon: "✅",
    roles: ["admin", "verification_manager"],
  },
  {
    slug: "customer-success",
    label: "Customer Success",
    href: "/hq/customer-success",
    icon: "💬",
    roles: ["admin", "support"],
  },
  {
    slug: "operations",
    label: "Operations",
    href: "/hq/operations",
    icon: "📊",
    roles: ["admin", "verification_manager", "support"],
  },
  {
    slug: "legal",
    label: "Legal & Compliance",
    href: "/hq/legal",
    icon: "⚖️",
    roles: ["admin"],
  },
  {
    slug: "finance",
    label: "Finance",
    href: "/hq/finance",
    icon: "💰",
    roles: ["admin"],
  },
  {
    slug: "technical",
    label: "Technical",
    href: "/hq/technical",
    icon: "⚙️",
    roles: ["admin", "developer"],
  },
];

export function canAccessDepartment(role: HqRole, slug: string): boolean {
  if (role === "admin") return true;
  const dept = DEPARTMENTS.find((d) => d.slug === slug);
  if (!dept) return false;
  return dept.roles.includes(role);
}

export function visibleDepartments(role: HqRole): Department[] {
  return DEPARTMENTS.filter((d) => role === "admin" || d.roles.includes(role));
}
