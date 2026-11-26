import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export default async function LoginPage() {
  ensureSeed();
  const user = await getCurrentUser();
  if (user) redirect(user.role === "platform_admin" ? "/admin" : "/dashboard");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_top,#e6f6f1,transparent_60%)] px-4 py-10">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-brand-700 text-lg font-bold text-white">ع</div>
        <div>
          <p className="text-lg font-extrabold text-slate-900">عيادتي</p>
          <p className="text-xs font-medium text-slate-600">منصة إدارة العيادات الطبية</p>
        </div>
      </div>
      <LoginForm />
    </main>
  );
}
