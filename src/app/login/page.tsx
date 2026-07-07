"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { signIn } from "./actions";

function initialErrorFromUrl(searchParams: URLSearchParams): string | null {
  const errorCode = searchParams.get("error");
  if (errorCode === "profile_setup_failed") {
    const detail = searchParams.get("detail");
    return `Signed in, but couldn't set up your HQ profile${detail ? `: ${detail}` : "."} Check that supabase/schema.sql (including RLS policies) has been run against your Supabase project.`;
  }
  return null;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => initialErrorFromUrl(searchParams));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn({
        email,
        password,
        redirectTo: searchParams.get("redirectTo"),
      });

      // signIn() redirects server-side on success — Next.js follows that
      // automatically, so we only ever get a return value back on failure.
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
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
