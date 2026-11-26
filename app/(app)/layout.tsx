import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";
import { ensureSeed } from "@/lib/seed";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  ensureSeed();
  const user = await requireUser();
  const unread = user.clinicId ? unreadCount(user.clinicId) : 0;

  return (
    <AppShell
      user={{ name: user.name, role: user.role, clinicName: user.clinicName, specialty: user.specialty }}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
