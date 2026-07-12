import { requireProfile } from "@/lib/auth/session";
import { requireDepartmentAccess } from "@/lib/auth/guard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const TOOLS = [
  {
    name: "Claude Code",
    description: "AI pair-programmer for shipping features and fixes to this repo.",
    icon: "🤖",
    href: "https://claude.com/claude-code",
  },
  {
    name: "GitHub — FurFinds HQ",
    description: "Source control, pull requests, and CI for this repo.",
    icon: "🐙",
    href: "https://github.com/furfinds/furfinds-hq",
  },
  {
    name: "GitHub — FurFinds (website)",
    description: "Source control, pull requests, and CI for the public site.",
    icon: "🐙",
    href: "https://github.com/furfinds/furfinds",
  },
  {
    name: "Supabase",
    description: "Database, auth, and storage backing this dashboard.",
    icon: "⚡",
    href: "https://supabase.com/dashboard",
  },
  {
    name: "Vercel",
    description: "Hosting and deployments for the HQ frontend.",
    icon: "▲",
    href: "https://vercel.com/dashboard",
  },
];

export default async function TechnicalPage() {
  const { profile } = await requireProfile();
  requireDepartmentAccess(profile, "technical");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Technical</h2>
        <p className="text-sm text-slate-500">Quick access to the tools that run FurFinds.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Card key={tool.name}>
            <div className="flex items-start gap-4">
              <span className="text-3xl">{tool.icon}</span>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900">{tool.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
                <a href={tool.href} target="_blank" rel="noreferrer" className="mt-3 inline-block">
                  <Button variant="secondary" size="sm">
                    Open {tool.name} ↗
                  </Button>
                </a>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Environment" subtitle="Current deployment configuration" />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Environment</dt>
            <dd className="mt-1">
              <Badge tone={process.env.NODE_ENV === "production" ? "success" : "warning"}>
                {process.env.NODE_ENV}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Supabase project</dt>
            <dd className="mt-1 text-sm text-slate-700">
              {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Connected" : "Not configured"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Your role</dt>
            <dd className="mt-1 text-sm capitalize text-slate-700">
              {profile.role.replace(/_/g, " ")}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
