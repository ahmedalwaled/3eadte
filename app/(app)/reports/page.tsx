import Link from "next/link";
import { requireClinicUser, can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { appointmentsInRange, clinicCurrencies, paymentsByCurrency, totalsInRange } from "@/lib/queries";
import { monthRange, money, todayISO, formatShortDate } from "@/lib/format";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { DownloadIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireClinicUser(["doctor", "secretary"]);
  if (!can(user, "reports")) redirect("/dashboard");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? (sp.month as string) : todayISO().slice(0, 7);
  const { from, to } = monthRange(month);

  const totals = await totalsInRange(user.clinicId, from, to);
  const monthAppointments = await appointmentsInRange(user.clinicId, from, to);
  const statusCounts = ["booked", "arrived", "waiting", "in_visit", "done", "no_show", "cancelled"].map((status) => ({
    status,
    count: monthAppointments.filter((item) => item.status === status).length,
  }));

  const visitsCount = Number(
    (
      await all<{ n: number }>("SELECT COUNT(*) AS n FROM visits WHERE clinic_id = ? AND substr(visit_date, 1, 10) BETWEEN ? AND ?", [
        user.clinicId,
        from,
        to,
      ])
    )[0]?.n ?? 0,
  );
  const newPatients = Number(
    (
      await all<{ n: number }>(
        "SELECT COUNT(*) AS n FROM patients WHERE clinic_id = ? AND substr(created_at, 1, 10) BETWEEN ? AND ?",
        [user.clinicId, from, to],
      )
    )[0]?.n ?? 0,
  );

  const revenueByMonth = (
    await all<{ month: string; total: number }>(
      `SELECT substr(paid_at, 1, 7) AS month, COALESCE(SUM(amount * COALESCE(rate, 1)), 0) AS total
       FROM payments WHERE clinic_id = ? GROUP BY month ORDER BY month DESC LIMIT 6`,
      [user.clinicId],
    )
  ).reverse();

  const topDiagnoses = await all<{ diagnosis: string; n: number }>(
    `SELECT diagnosis, COUNT(*) AS n FROM visits
      WHERE clinic_id = ? AND substr(visit_date, 1, 10) BETWEEN ? AND ? AND diagnosis <> ''
      GROUP BY diagnosis ORDER BY n DESC LIMIT 6`,
    [user.clinicId, from, to],
  );

  const receivables = await all<{ id: string; name: string; balance: number }>(
    `SELECT * FROM (
        SELECT p.id, p.name,
               COALESCE((SELECT SUM(v.fee - v.discount) FROM visits v WHERE v.patient_id = p.id), 0)
                 - COALESCE((SELECT SUM(pay.amount * COALESCE(pay.rate, 1)) FROM payments pay WHERE pay.patient_id = p.id), 0) AS balance
          FROM patients p WHERE p.clinic_id = ?
     ) WHERE balance > 0 ORDER BY balance DESC LIMIT 6`,
    [user.clinicId],
  );

  const byCurrency = await paymentsByCurrency(user.clinicId, user.currency, from, to);
  const currencies = await clinicCurrencies(user.clinicId);
  const hasForeign = byCurrency.some((row) => row.currency !== user.currency);

  const maxRevenue = Math.max(1, ...revenueByMonth.map((row) => Number(row.total)));
  const noShowRate = monthAppointments.length
    ? Math.round(((statusCounts.find((s) => s.status === "no_show")?.count ?? 0) / monthAppointments.length) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        title="التقارير"
        subtitle="مؤشرات الأداء المالي والتشغيلي للعيادة"
        actions={
          <>
            <form action="/reports" className="flex items-center gap-2">
              <input type="month" name="month" defaultValue={month} className="input !py-2 text-[13px]" aria-label="الشهر" />
              <button className="btn-ghost !py-2 text-xs">عرض</button>
            </form>
            <Link href={`/api/export/payments?from=${from}&to=${to}`} className="btn-ghost" prefetch={false}>
              <DownloadIcon className="size-4" />
              المقبوضات
            </Link>
            <Link href={`/api/export/visits?from=${from}&to=${to}`} className="btn-ghost" prefetch={false}>
              <DownloadIcon className="size-4" />
              الزيارات
            </Link>
            <Link href={`/reports/print?month=${month}`} className="btn-primary" prefetch={false} target="_blank">
              تصدير PDF
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إيراد الشهر" value={money(totals.paid, user.currency)} hint={`${visitsCount} زيارة`} />
        <StatCard label="المصاريف" value={money(totals.spent, user.currency)} accent="rose" hint="خلال الشهر" />
        <StatCard label="الصافي" value={money(totals.net, user.currency)} accent="sky" hint="بعد خصم المصاريف" />
        <StatCard label="مرضى جدد" value={newPatients} accent="amber" hint={`نسبة عدم الحضور ${noShowRate}%`} />
      </div>

      {hasForeign ? (
        <section className="card card-pad mt-4">
          <h2 className="section-title mb-3">التحصيل حسب العملة</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="th">العملة</th>
                  <th className="th">عدد الدفعات</th>
                  <th className="th">الإجمالي بعملتها</th>
                  <th className="th">المعادل بـ {user.currency}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byCurrency.map((row) => (
                  <tr key={row.currency}>
                    <td className="td font-semibold text-slate-800">{row.currency}</td>
                    <td className="td">{Number(row.count)}</td>
                    <td className="td">{money(Number(row.amount), row.currency)}</td>
                    <td className="td font-bold text-emerald-700">{money(Number(row.base), user.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {currencies.length ? (
            <p className="mt-2 text-[11px] text-slate-400">
              أسعار الصرف: {currencies.map((item) => `1 ${item.code} = ${item.rate} ${user.currency}`).join(" · ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <h2 className="section-title mb-3">الإيراد خلال آخر 6 أشهر</h2>
          <div className="flex h-48 items-end gap-3" dir="ltr">
            {revenueByMonth.length === 0 ? (
              <p className="text-xs text-slate-500">لا توجد مقبوضات بعد.</p>
            ) : (
              revenueByMonth.map((row) => (
                <div key={row.month} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-semibold text-slate-500">{Math.round(Number(row.total))}</span>
                  <div className="w-full max-w-16 rounded-t-lg bg-brand-600/85" style={{ height: `${(Number(row.total) / maxRevenue) * 150}px` }} />
                  <span className="text-[10px] text-slate-400">{row.month}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3">حالات المواعيد</h2>
          <ul className="space-y-1.5 text-[13px]">
            {statusCounts.map((item) => (
              <li key={item.status} className="flex items-center justify-between">
                <StatusBadge status={item.status} />
                <span className="font-bold text-slate-700">{item.count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">إجمالي {monthAppointments.length} موعداً في الشهر.</p>
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3">أكثر التشخيصات</h2>
          {topDiagnoses.length === 0 ? (
            <p className="text-xs text-slate-500">لا بيانات كافية.</p>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {topDiagnoses.map((item) => (
                <li key={item.diagnosis} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700">{item.diagnosis}</span>
                  <span className="badge bg-slate-100 text-slate-600 ring-slate-200">{item.n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card-pad lg:col-span-2">
          <h2 className="section-title mb-3">مستحقات المرضى</h2>
          {receivables.length === 0 ? (
            <EmptyState title="لا مستحقات" body="جميع الملفات مسددة." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {receivables.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/patients/${row.id}?tab=payments`} className="truncate text-[13px] font-semibold text-slate-800 hover:text-brand-700">
                    {row.name}
                  </Link>
                  <span className="text-sm font-bold text-rose-700">{money(Number(row.balance), user.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-4 text-[11px] text-slate-400">
        التقارير محسوبة من {formatShortDate(from)} إلى {formatShortDate(to)} — ملفات التصدير بصيغة CSV تُفتح مباشرة في Excel.
      </p>
    </div>
  );
}
