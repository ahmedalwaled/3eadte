import { requireAdmin } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { toggleClinic } from "@/lib/actions/admin";
import ClinicForm from "@/components/ClinicForm";
import { PageHeader, StatCard } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  const clinics = await all<{
    id: string;
    name: string;
    phone: string;
    address: string;
    currency: string;
    active: number;
    created_at: string;
    patients: number;
    staff: number;
    visits: number;
    revenue: number;
  }>(
    `SELECT c.*,
        (SELECT COUNT(*) FROM patients p WHERE p.clinic_id = c.id) AS patients,
        (SELECT COUNT(*) FROM users u WHERE u.clinic_id = c.id) AS staff,
        (SELECT COUNT(*) FROM visits v WHERE v.clinic_id = c.id) AS visits,
        (SELECT COALESCE(SUM(pay.amount * COALESCE(pay.rate, 1)), 0) FROM payments pay WHERE pay.clinic_id = c.id) AS revenue
       FROM clinics c ORDER BY c.created_at DESC`,
  );

  const totals = await get<{ patients: number; visits: number; revenue: number }>(
    `SELECT (SELECT COUNT(*) FROM patients) AS patients,
            (SELECT COUNT(*) FROM visits) AS visits,
            (SELECT COALESCE(SUM(amount), 0) FROM payments) AS revenue`,
  );

  return (
    <div>
      <PageHeader title="إدارة المنصة" subtitle="العيادات المشتركة في المنصة مع بيانات معزولة لكل عيادة" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="العيادات" value={clinics.length} hint={`${clinics.filter((c) => c.active).length} نشطة`} />
        <StatCard label="إجمالي المرضى" value={Number(totals?.patients ?? 0)} accent="sky" />
        <StatCard label="إجمالي الزيارات" value={Number(totals?.visits ?? 0)} accent="amber" />
        <StatCard label="إجمالي المقبوضات" value={Number(totals?.revenue ?? 0).toLocaleString("en-US")} accent="rose" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <h2 className="section-title mb-3">العيادات</h2>
          <ul className="divide-y divide-slate-100">
            {clinics.map((clinic) => (
              <li key={clinic.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-800">
                  {clinic.name.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{clinic.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {clinic.patients} مريضاً · {clinic.staff} مستخدماً · {clinic.visits} زيارة · منذ {formatDate(clinic.created_at.slice(0, 10))}
                  </p>
                </div>
                <span
                  className={`badge ${clinic.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}
                >
                  {clinic.active ? "نشطة" : "موقوفة"}
                </span>
                <form action={toggleClinic}>
                  <input type="hidden" name="id" value={clinic.id} />
                  <button className="text-xs font-semibold text-slate-500 hover:text-brand-700">{clinic.active ? "إيقاف" : "تفعيل"}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3">إضافة عيادة</h2>
          <ClinicForm />
        </section>
      </div>
    </div>
  );
}
