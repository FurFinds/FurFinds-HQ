import { requireProfile } from "@/lib/auth/session";
import { HqShell } from "@/components/layout/HqShell";

export default async function HqLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();

  return <HqShell profile={profile}>{children}</HqShell>;
}
