import Link from "next/link";
import { requireClinicUser, can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { expensesInRange, paymentsInRange, totalsInRange, clinicBalances, clinicCurrencies, paymentsByCurrency } from "@/lib/queries";
import { formatShortDate, money, monthRange, todayISO } from "@/lib/format";
import { deleteExpense, deletePayment } from "@/lib/actions/finance";
import PaymentForm from "@/components/PaymentForm";
import ExpenseForm from "@/components/ExpenseForm";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { DownloadIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = { cash: "نقداً", card: "شبكة", transfer: "تحويل", insurance: "تأمين" };
const CATEGORY_LABEL: Record<string, string> = {
  rent: "إيجار",
  supplies: "مستلزمات",
  utilities: "فواتير",
  salaries: "رواتب",
  maintenance: "صيانة",
  marketing: "تسويق",
  general: "أخرى",
};

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireClinicUser();
  if (!can(user, "finance")) redirect("/dashboard");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? (sp.month as string) : todayISO().slice(0, 7);
  const { from, to } = monthRange(month);

  const payments = paymentsInRange(user.clinicId, from, to);
  const expenses = expensesInRange(user.clinicId, from, to);
  const totals = totalsInRange(user.clinicId, from, to);
  const balances = clinicBalances(user.clinicId);
  const currencies = clinicCurrencies(user.clinicId);
  const byCurrency = paymentsByCurrency(user.clinicId, user.currency, from, to);
  const patients = all<{ id: string; name: string }>(
    "SELECT id, name FROM patients WHERE clinic_id = ? ORDER BY name LIMIT 500",
    [user.clinicId],
  );
  const isDoctor = user.role === "doctor";
  const hasForeign = byCurrency.some((row) => row.currency !== user.currency);

  return (
    <div>
      <PageHeader
        title="الحسابات المالية"
        subtitle="المقبوضات والمصاريف ورصيد المرضى"
        actions={
          <>
            <Link href={`/api/export/payments?from=${from}&to=${to}`} className="btn-ghost" prefetch={false}>
              <DownloadIcon className="size-4" />
              تصدير المقبوضات
            </Link>
            <Link href={`/reports/print?month=${month}`} className="btn-ghost" prefetch={false} target="_blank">
              تقرير PDF
            </Link>
            <form action="/finance" className="flex items-center gap-2">
              <input type="month" name="month" defaultValue={month} className="input !py-2 text-[13px]" aria-label="الشهر" />
              <button className="btn-ghost !py-2 text-xs">عرض</button>
            </form>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="المقبوضات" value={money(totals.paid, user.currency)} hint="خلال الشهر المحدد" />
        <StatCard label="المصاريف" value={money(totals.spent, user.currency)} hint={`${expenses.length} مصروفاً`} accent="rose" />
        <StatCard label="الصافي" value={money(totals.net, user.currency)} hint="المقبوضات - المصاريف" accent="sky" />
        <StatCard label="مستحقات المرضى" value={money(balances.outstanding, user.currency)} hint="غير محصلة إجمالاً" accent="amber" />
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
        </section>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card card-pad">
            <h2 className="section-title mb-3">المقبوضات ({payments.length})</h2>
            {payments.length === 0 ? (
              <EmptyState title="لا مقبوضات في هذا الشهر" body="سجّل دفعة من النموذج المجاور." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="th">التاريخ</th>
                      <th className="th">المريض</th>
                      <th className="th">المبلغ</th>
                      <th className="th">الطريقة</th>
                      <th className="th" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-slate-50/60">
                        <td className="td whitespace-nowrap">{formatShortDate(payment.paid_at)}</td>
                        <td className="td">
                          <Link href={`/patients/${payment.patient_id}?tab=payments`} className="font-semibold text-slate-800 hover:text-brand-700">
                            {payment.patient_name}
                          </Link>
                        </td>
                        <td className="td font-bold text-emerald-700 whitespace-nowrap">
                          {money(payment.amount, payment.currency || user.currency)}
                          {payment.currency && payment.currency !== user.currency ? (
                            <span className="block text-[11px] font-medium text-slate-400">
                              ≈ {money(payment.amount * Number(payment.rate || 1), user.currency)}
                            </span>
                          ) : null}
                        </td>
                        <td className="td">{METHOD_LABEL[payment.method] ?? payment.method}</td>
                        <td className="td text-left">
                          {isDoctor ? (
                            <form action={deletePayment}>
                              <input type="hidden" name="id" value={payment.id} />
                              <button className="text-xs font-semibold text-rose-600 hover:underline">حذف</button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="section-title mb-3">المصاريف ({expenses.length})</h2>
            {expenses.length === 0 ? (
              <EmptyState title="لا مصاريف مسجلة" body="أضف مصاريف العيادة لمتابعة الصافي." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <li key={expense.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-800">{expense.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatShortDate(expense.spent_at)} · {CATEGORY_LABEL[expense.category] ?? expense.category}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-rose-700">{money(expense.amount, expense.currency || user.currency)}</span>
                    {isDoctor ? (
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={expense.id} />
                        <button className="text-xs font-semibold text-slate-400 hover:text-rose-600">حذف</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card card-pad">
            <h2 className="section-title mb-3">تسجيل دفعة</h2>
            <PaymentForm patients={patients} backTo={`/finance?month=${month}`} baseCurrency={user.currency} currencies={currencies} />
          </section>
          <section className="card card-pad">
            <h2 className="section-title mb-3">تسجيل مصروف</h2>
            <ExpenseForm baseCurrency={user.currency} currencies={currencies} />
          </section>
        </div>
      </div>
    </div>
  );
}
