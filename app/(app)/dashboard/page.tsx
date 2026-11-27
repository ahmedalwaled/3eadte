import Link from "next/link";
import { can, requireClinicUser } from "@/lib/auth";
import { dashboardStats, notificationsFor, revenueLastDays } from "@/lib/queries";
import { money, todayISO, timeOf, formatDate, formatWeekday, addDays } from "@/lib/format";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import GlobalSearch from "@/components/GlobalSearch";
import { CalendarIcon, ClockIcon, PlusIcon, UsersIcon, WalletIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const NEXT_ACTION: Record<string, { label: string; status: string } | undefined> = {
  booked: { label: "تأكيد الحضور", status: "arrived" },
  arrived: { label: "إدخال الانتظار", status: "waiting" },
  waiting: { label: "بدء المعاينة", status: "in_visit" },
};

export default async function DashboardPage() {
  const user = await requireClinicUser();
  const showAppointments = can(user, "appointments");
  const showPatients = can(user, "patients");
  const showFinance = can(user, "finance");

  const date = todayISO();
  const stats = await dashboardStats(user.clinicId, date);
  const revenue = showFinance ? await revenueLastDays(user.clinicId, 7) : [];
  const alerts = await notificationsFor(user.clinicId, 4);
  const maxRevenue = Math.max(1, ...revenue.map((r) => Number(r.total)));

  const waiting = (stats.counts.waiting ?? 0) + (stats.counts.arrived ?? 0);

  return (
    <div>
      <PageHeader
        title={`مساء الخير، ${user.name.replace(/^د\.\s*/, "د. ")}`}
        subtitle={`${formatWeekday(date)} ${formatDate(date)} — إليك ملخص اليوم في ${user.clinicName ?? "العيادة"}`}
        actions={
          <>
            {showAppointments ? (
              <Link href="/appointments/new" className="btn-primary">
                <PlusIcon className="size-4" />
                حجز موعد
              </Link>
            ) : null}
            {showPatients ? (
              <Link href="/patients/new" className="btn-ghost">
                <UsersIcon className="size-4" />
                مريض جديد
              </Link>
            ) : null}
          </>
        }
      />

      <GlobalSearch />

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {showAppointments ? (
          <>
            <StatCard label="مواعيد اليوم" value={stats.today.length} hint={`${stats.counts.done ?? 0} زيارة مكتملة`} />
            <StatCard label="في الانتظار" value={waiting} hint="بحاجة إلى استقبال" accent="amber" />
          </>
        ) : null}
        {showFinance ? (
          <>
            <StatCard label="إيراد اليوم" value={money(stats.revenueToday, user.currency)} hint="المبالغ المقبوضة" accent="sky" />
            <StatCard
              label="مستحقات غير محصلة"
              value={money(stats.outstanding, user.currency)}
              hint={showPatients ? `${stats.patients} مريضاً مسجلاً` : "مبالغ متبقية على المرضى"}
              accent="rose"
            />
          </>
        ) : null}
        {!showAppointments && !showFinance ? (
          <div className="col-span-2 lg:col-span-4">
            <StatCard
              label="المرضى المسجلون"
              value={showPatients ? stats.patients : 0}
              hint={showPatients ? "إجمالي ملفات المرضى في العيادة" : "لا توجد أقسام متاحة لحسابك"}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {showAppointments ? (
          <section className="card card-pad lg:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="section-title flex items-center gap-2">
                <CalendarIcon className="size-5 text-brand-700" />
                قائمة اليوم
              </h2>
              <Link href="/appointments" className="text-xs font-semibold text-brand-700 hover:underline">
                التقويم الكامل
              </Link>
            </div>

            {stats.today.length === 0 ? (
              <EmptyState
                title="لا توجد مواعيد اليوم"
                body="ابدأ بحجز موعد لمريض ليظهر في القائمة."
                action={
                  <Link href="/appointments/new" className="btn-soft mt-2">
                    حجز موعد
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.today.map((appt) => {
                  const next = NEXT_ACTION[appt.status];
                  return (
                    <li key={appt.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-slate-50 py-1.5">
                        <span className="text-sm font-bold text-slate-800">{timeOf(appt.starts_at)}</span>
                        <span className="text-[10px] text-slate-600">{appt.duration} د</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/patients/${appt.patient_id}`}
                          className="block truncate text-sm font-bold text-slate-800 hover:text-brand-700"
                        >
                          {appt.patient_name}
                        </Link>
                        <p className="truncate text-[11px] text-slate-600">
                          {appt.reason || "بدون سبب محدد"} · {appt.patient_phone}
                        </p>
                      </div>
                      <StatusBadge status={appt.status} />
                      <div className="flex items-center gap-2">
                        {next ? (
                          <form action={updateAppointmentStatus}>
                            <input type="hidden" name="id" value={appt.id} />
                            <input type="hidden" name="status" value={next.status} />
                            <button className="btn-soft !px-3 !py-1.5 text-xs">{next.label}</button>
                          </form>
                        ) : null}
                        {appt.status === "in_visit" || appt.visit_id ? (
                          <Link
                            href={appt.visit_id ? `/visits/${appt.visit_id}` : `/appointments/${appt.id}/visit`}
                            className="btn-primary !px-3 !py-1.5 text-xs"
                          >
                            {appt.visit_id ? "فتح الزيارة" : "بدء الزيارة"}
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        <div className={showAppointments ? "flex flex-col gap-4" : "grid gap-4 lg:col-span-3 lg:grid-cols-3"}>
          {showFinance ? (
            <section className="card card-pad">
              <h2 className="section-title mb-3 flex items-center gap-2">
                <WalletIcon className="size-5 text-brand-700" />
                إيراد آخر 7 أيام
              </h2>
              {revenue.length === 0 ? (
                <p className="text-xs text-slate-600">لا توجد مقبوضات بعد.</p>
              ) : (
                <div className="flex h-32 items-end justify-between gap-2" dir="ltr">
                  {revenue.map((row) => {
                    const height = Math.max(6, Math.round((Number(row.total) / maxRevenue) * 100));
                    return (
                      <div key={row.day} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold text-slate-600">
                          {Number(row.total) > 0 ? Math.round(Number(row.total)) : ""}
                        </span>
                        <div className="flex w-full items-end justify-center" style={{ height: "80px" }}>
                          <div
                            className="w-6 rounded-t-md bg-brand-600/80"
                            style={{ height: `${height}%` }}
                            title={row.day}
                          />
                        </div>
                        <span className="text-[10px] text-slate-600">{row.day.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          <section className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">التنبيهات</h2>
              <Link href="/notifications" className="text-xs font-semibold text-brand-700 hover:underline">
                الكل
              </Link>
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-600">لا توجد تنبيهات.</p>
            ) : (
              <ul className="space-y-2.5">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex gap-2">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        alert.kind === "warning"
                          ? "bg-rose-400"
                          : alert.kind === "appointment"
                            ? "bg-sky-400"
                            : "bg-brand-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800">{alert.title}</p>
                      <p className="truncate text-[11px] text-slate-600">{alert.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {showAppointments ? (
            <section className="card card-pad">
              <h2 className="section-title mb-2 flex items-center gap-2">
                <ClockIcon className="size-5 text-brand-700" />
                متابعات قادمة
              </h2>
              <p className="text-xs text-slate-600">
                غداً {formatWeekday(addDays(date, 1))} — {formatDate(addDays(date, 1))}
              </p>
              <Link href={`/appointments?date=${addDays(date, 1)}`} className="btn-ghost mt-3 w-full !py-2 text-xs">
                عرض مواعيد الغد
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
