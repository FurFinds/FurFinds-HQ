"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

const DEFAULT_REDIRECT = "/hq/dashboard";

/** Only follow redirectTo if it's a safe, internal HQ path — otherwise fall back to the dashboard. */
function resolveRedirect(rawRedirect: string | null): string {
  if (
    !rawRedirect ||
    !rawRedirect.startsWith("/") ||
    rawRedirect.startsWith("//") ||
    rawRedirect === "/login" ||
    rawRedirect === "/signup"
  ) {
    return DEFAULT_REDIRECT;
  }
  return rawRedirect;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Full page navigation (not router.push) so the server re-evaluates
    // auth against the freshly-written session cookies on the next request.
    const redirectTo = resolveRedirect(searchParams.get("redirectTo"));
    window.location.assign(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@furfinds.com"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {error && (
        <p className="rounded-lg bg-ff-error/10 px-3 py-2 text-sm text-[#b91c1c]">{error}</p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your department workspace."
      footer={
        <span>
          Need an HQ account?{" "}
          <Link href="/signup" className="font-medium text-white underline underline-offset-2">
            Request access
          </Link>
        </span>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
