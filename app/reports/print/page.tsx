import Link from "next/link";
import { requireClinicUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { appointmentsInRange, clinicBalances, clinicCurrencies, paymentsByCurrency, totalsInRange } from "@/lib/queries";
import { APPOINTMENT_STATUS, formatDate, money, monthRange, todayISO } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(APPOINTMENT_STATUS).map(([key, value]) => [key, value.label]),
);

const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return `${MONTH_NAMES[index - 1] ?? ""} ${year}`;
}

export default async function PrintableReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireClinicUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? (sp.month as string) : todayISO().slice(0, 7);
  const { from, to } = monthRange(month);

  const clinic = await get<{ name: string; phone: string; address: string; currency: string }>(
    "SELECT name, phone, address, currency FROM clinics WHERE id = ?",
    [user.clinicId],
  );
  const totals = await totalsInRange(user.clinicId, from, to);
  const balances = await clinicBalances(user.clinicId);
  const appointments = await appointmentsInRange(user.clinicId, from, to);
  const currencies = await clinicCurrencies(user.clinicId);
  const byCurrency = await paymentsByCurrency(user.clinicId, user.currency, from, to);

  const revenueByMonth = await all<{ month: string; total: number }>(
    `SELECT substr(paid_at, 1, 7) AS month, COALESCE(SUM(amount * COALESCE(rate, 1)), 0) AS total
       FROM payments WHERE clinic_id = ? GROUP BY month ORDER BY month DESC LIMIT 6`,
    [user.clinicId],
  );
  revenueByMonth.reverse();

  const statusCounts = await all<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM appointments
      WHERE clinic_id = ? AND substr(starts_at, 1, 10) BETWEEN ? AND ? GROUP BY status ORDER BY n DESC`,
    [user.clinicId, from, to],
  );

  const newPatients = Number(
    (
      await all<{ n: number }>("SELECT COUNT(*) AS n FROM patients WHERE clinic_id = ? AND substr(created_at, 1, 10) BETWEEN ? AND ?", [
      user.clinicId,
      from,
      to,
      ])
    )[0]?.n ?? 0,
  );
  const topDiagnoses = await all<{ diagnosis: string; n: number }>(
    `SELECT diagnosis, COUNT(*) AS n FROM visits
      WHERE clinic_id = ? AND substr(visit_date, 1, 10) BETWEEN ? AND ? AND diagnosis <> ''
      GROUP BY diagnosis ORDER BY n DESC LIMIT 8`,
    [user.clinicId, from, to],
  );

  const receivables = await all<{ id: string; name: string; balance: number }>(
    `SELECT * FROM (
        SELECT p.id, p.name,
               COALESCE((SELECT SUM(v.fee - v.discount) FROM visits v WHERE v.patient_id = p.id), 0)
                 - COALESCE((SELECT SUM(pay.amount * COALESCE(pay.rate, 1)) FROM payments pay WHERE pay.patient_id = p.id), 0) AS balance
          FROM patients p WHERE p.clinic_id = ?
     ) WHERE balance > 0 ORDER BY balance DESC LIMIT 10`,
    [user.clinicId],
  );

  const expenses = await all<{ title: string; amount: number; category: string }>(
    `SELECT title, COALESCE(amount * COALESCE(rate, 1), 0) AS amount, category FROM expenses
      WHERE clinic_id = ? AND substr(spent_at, 1, 10) BETWEEN ? AND ? ORDER BY amount DESC LIMIT 10`,
    [user.clinicId, from, to],
  );

  const completed = appointments.filter((row) => row.status === "done").length;
  const noShow = appointments.filter((row) => row.status === "no_show").length;
  const maxRevenue = Math.max(1, ...revenueByMonth.map((row) => Number(row.total)));

  return (
    <main className="mx-auto max-w-[210mm] bg-white px-5 py-6 sm:my-6 sm:rounded-2xl sm:ring-1 sm:ring-slate-200 print:my-0 print:ring-0">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link href={`/reports?month=${month}`} className="btn-ghost">
          رجوع للتقارير
        </Link>
        <PrintButton label="طباعة / حفظ PDF" />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-brand-700 pb-3">
        <div>
          <p className="text-xl font-extrabold text-brand-800">{clinic?.name ?? user.clinicName}</p>
          {clinic?.address ? <p className="mt-0.5 text-xs text-slate-500">{clinic.address}</p> : null}
          {clinic?.phone ? (
            <p className="text-xs text-slate-500" dir="ltr">
              {clinic.phone}
            </p>
          ) : null}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-slate-700">التقرير المالي الشهري</p>
          <p className="text-[12px] text-slate-600">{monthLabel(month)}</p>
          <p className="text-[11px] text-slate-400">العملة الأساسية: {user.currency}</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2 print:grid-cols-4">
        {[
          { label: "المقبوضات", value: money(totals.paid, user.currency) },
          { label: "المصاريف", value: money(totals.spent, user.currency) },
          { label: "الصافي", value: money(totals.net, user.currency) },
          { label: "مستحقات المرضى", value: money(balances.outstanding, user.currency) },
        ].map((item) => (
          <div key={item.label} className="print-keep rounded-xl border border-slate-200 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-slate-800">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 px-4 py-3 text-[12px] print:grid-cols-4">
        <p>
          <span className="text-slate-500">إجمالي المواعيد: </span>
          <span className="font-bold text-slate-800">{appointments.length}</span>
        </p>
        <p>
          <span className="text-slate-500">زيارات مكتملة: </span>
          <span className="font-bold text-slate-800">{completed}</span>
        </p>
        <p>
          <span className="text-slate-500">لم يحضر: </span>
          <span className="font-bold text-slate-800">{noShow}</span>
        </p>
        <p>
          <span className="text-slate-500">مرضى جدد: </span>
          <span className="font-bold text-slate-800">{newPatients}</span>
        </p>
      </section>

      <section className="mt-5 print-keep">
        <h2 className="mb-2 border-b border-slate-200 pb-1 text-[13px] font-extrabold text-slate-800">الإيرادات — آخر ستة أشهر</h2>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="border border-slate-200 px-2 py-1.5 text-right">الشهر</th>
              <th className="border border-slate-200 px-2 py-1.5 text-right">المبلغ</th>
              <th className="border border-slate-200 px-2 py-1.5 text-right">النسبة</th>
            </tr>
          </thead>
          <tbody>
            {revenueByMonth.length === 0 ? (
              <tr>
                <td colSpan={3} className="border border-slate-200 px-2 py-2 text-center text-slate-400">
                  لا بيانات
                </td>
              </tr>
            ) : (
              revenueByMonth.map((row) => (
                <tr key={row.month}>
                  <td className="border border-slate-200 px-2 py-1.5">{monthLabel(row.month)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-semibold">{money(Number(row.total), user.currency)}</td>
                  <td className="border border-slate-200 px-2 py-1.5">
                    <span className="inline-block h-2 rounded-full bg-brand-500 align-middle" style={{ width: `${Math.round((Number(row.total) / maxRevenue) * 60)}%` }} />
                    <span className="ms-2 text-slate-500">{Math.round((Number(row.total) / maxRevenue) * 100)}%</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className="mt-5 grid gap-4 print:grid-cols-2">
        <section className="print-keep">
          <h2 className="mb-2 border-b border-slate-200 pb-1 text-[13px] font-extrabold text-slate-800">حالات المواعيد</h2>
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              {statusCounts.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-2 py-2 text-center text-slate-400">لا مواعيد</td>
                </tr>
              ) : (
                statusCounts.map((row) => (
                  <tr key={row.status}>
                    <td className="border border-slate-200 px-2 py-1.5">{STATUS_LABEL[row.status] ?? row.status}</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">{Number(row.n)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="print-keep">
          <h2 className="mb-2 border-b border-slate-200 pb-1 text-[13px] font-extrabold text-slate-800">التحصيل حسب العملة</h2>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="border border-slate-200 px-2 py-1.5 text-right">العملة</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">الإجمالي</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">بـ {user.currency}</th>
              </tr>
            </thead>
            <tbody>
              {byCurrency.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-slate-200 px-2 py-2 text-center text-slate-400">
                    لا مقبوضات
                  </td>
                </tr>
              ) : (
                byCurrency.map((row) => (
                  <tr key={row.currency}>
                    <td className="border border-slate-200 px-2 py-1.5">{row.currency}</td>
                    <td className="border border-slate-200 px-2 py-1.5">{money(Number(row.amount), row.currency)}</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">{money(Number(row.base), user.currency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {currencies.length ? (
            <p className="mt-1 text-[10px] text-slate-400">
              أسعار الصرف: {currencies.map((item) => `1 ${item.code} = ${item.rate} ${user.currency}`).join(" · ")}
            </p>
          ) : null}
        </section>
      </div>

      <section className="mt-5 print-keep">
        <h2 className="mb-2 border-b border-slate-200 pb-1 text-[13px] font-extrabold text-slate-800">أعلى التشخيصات</h2>
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {topDiagnoses.length === 0 ? (
              <tr>
                <td className="border border-slate-200 px-2 py-2 text-center text-slate-400">لا تشخيصات مسجلة</td>
              </tr>
            ) : (
              topDiagnoses.map((row) => (
                <tr key={row.diagnosis}>
                  <td className="border border-slate-200 px-2 py-1.5">{row.diagnosis}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-semibold">{Number(row.n)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-5 print-keep">
        <h2 className="mb-2 border-b border-slate-200 pb-1 text-[13px] font-extrabold text-slate-800">مستحقات المرضى</h2>
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {receivables.length === 0 ? (
              <tr>
                <td className="border border-slate-200 px-2 py-2 text-center text-slate-400">لا مستحقات</td>
              </tr>
            ) : (
              receivables.map((row) => (
                <tr key={row.id}>
                  <td className="border border-slate-200 px-2 py-1.5">{row.name}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-semibold text-rose-700">{money(Number(row.balance), user.currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {expenses.length ? (
        <section className="mt-5 print-keep">
          <h2 className="mb-2 border-b border-slate-200 pb-1 text-[13px] font-extrabold text-slate-800">أكبر المصاريف</h2>
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              {expenses.map((row, index) => (
                <tr key={`${row.title}-${index}`}>
                  <td className="border border-slate-200 px-2 py-1.5">{row.title}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-semibold">{money(Number(row.amount), user.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="mt-6 flex items-center justify-between border-t border-slate-200 pt-2 text-[10px] text-slate-400">
        <span>أُنشئ في {formatDate(todayISO())}</span>
        <span>منصة عيادتي — تقرير آلي</span>
      </footer>
    </main>
  );
}
