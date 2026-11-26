import Link from "next/link";
import { requireClinicUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { appointmentsInRange, appointmentsOnDate } from "@/lib/queries";
import { addDays, formatDate, formatShortDate, formatWeekday, money, timeOf, todayISO } from "@/lib/format";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { StatusBadge, EmptyState, PageHeader } from "@/components/ui";
import { PlusIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

type View = "day" | "week" | "month";

const NEXT_ACTION: Record<string, { label: string; status: string } | undefined> = {
  booked: { label: "حضور", status: "arrived" },
  arrived: { label: "انتظار", status: "waiting" },
  waiting: { label: "معاينة", status: "in_visit" },
};

function monthGrid(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = first.getDay(); // 0 = Sunday
  const cells: string[] = [];
  for (let i = 0; i < lead; i += 1) cells.push("");
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(`${month}-${String(day).padStart(2, "0")}`);
  return cells;
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const user = await requireClinicUser();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? (sp.date as string) : todayISO();
  const view: View = sp.view === "week" || sp.view === "month" ? sp.view : "day";

  const dayList = await appointmentsOnDate(user.clinicId, date);
  const weekList = view === "day" ? [] : await appointmentsInRange(user.clinicId, addDays(date, -7), addDays(date, 30));

  return (
    <div>
      <PageHeader
        title="المواعيد"
        subtitle={`${formatWeekday(date)} ${formatDate(date)}`}
        actions={
          <Link href={`/appointments/new?date=${date}`} className="btn-primary">
            <PlusIcon className="size-4" />
            حجز موعد
          </Link>
        }
      />

      <div className="card card-pad mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Link href={`/appointments?date=${addDays(date, -1)}&view=${view}`} className="btn-ghost !size-9 !p-0" aria-label="اليوم السابق">
              ›
            </Link>
            <form action="/appointments" className="flex items-center gap-1">
              <input type="hidden" name="view" value={view} />
              <input type="date" name="date" defaultValue={date} className="input !py-2 text-[13px]" aria-label="اختر التاريخ" />
              <button className="btn-ghost !py-2 text-xs">انتقال</button>
            </form>
            <Link href={`/appointments?date=${addDays(date, 1)}&view=${view}`} className="btn-ghost !size-9 !p-0" aria-label="اليوم التالي">
              ‹
            </Link>
            <Link href={`/appointments?date=${todayISO()}&view=${view}`} className="btn-soft !py-2 text-xs">
              اليوم
            </Link>
          </div>

          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(["day", "week", "month"] as View[]).map((item) => (
              <Link
                key={item}
                href={`/appointments?date=${date}&view=${item}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === item ? "bg-white text-brand-800 shadow-sm" : "text-slate-500"}`}
              >
                {item === "day" ? "يوم" : item === "week" ? "أسبوع" : "شهر"}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {view === "day" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card card-pad lg:col-span-2">
            <h2 className="section-title mb-3">جدول اليوم ({dayList.length})</h2>
            {dayList.length === 0 ? (
              <EmptyState
                title="لا مواعيد في هذا اليوم"
                body="يمكنك حجز موعد جديد أو الانتقال إلى يوم آخر."
                action={
                  <Link href={`/appointments/new?date=${date}`} className="btn-soft mt-2">
                    حجز موعد
                  </Link>
                }
              />
            ) : (
              <ol className="relative space-y-2 border-r border-dashed border-slate-200 pr-4">
                {dayList.map((appt) => {
                  const next = NEXT_ACTION[appt.status];
                  return (
                    <li key={appt.id} className="relative">
                      <span className="absolute top-4 -right-[21px] size-2.5 rounded-full bg-brand-600 ring-4 ring-white" />
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                            {timeOf(appt.starts_at)}
                          </span>
                          <Link href={`/patients/${appt.patient_id}`} className="text-sm font-bold text-slate-800 hover:text-brand-700">
                            {appt.patient_name}
                          </Link>
                          <StatusBadge status={appt.status} />
                          <span className="ms-auto flex items-center gap-1.5">
                            {next ? (
                              <form action={updateAppointmentStatus}>
                                <input type="hidden" name="id" value={appt.id} />
                                <input type="hidden" name="status" value={next.status} />
                                <button className="btn-ghost !px-2.5 !py-1 text-[11px]">{next.label}</button>
                              </form>
                            ) : null}
                            {appt.status === "in_visit" || appt.visit_id ? (
                              <Link
                                href={appt.visit_id ? `/visits/${appt.visit_id}` : `/appointments/${appt.id}/visit`}
                                className="btn-primary !px-2.5 !py-1 text-[11px]"
                              >
                                {appt.visit_id ? "الزيارة" : "بدء"}
                              </Link>
                            ) : null}
                            <Link href={`/appointments/${appt.id}`} className="btn-ghost !px-2.5 !py-1 text-[11px]">
                              تفاصيل
                            </Link>
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12px] text-slate-500">
                          {appt.reason || "بدون سبب محدد"} · {appt.duration} دقيقة · {appt.doctor_name}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <aside className="space-y-4">
            <section className="card card-pad">
              <h2 className="section-title mb-2">ملخص اليوم</h2>
              <ul className="space-y-1.5 text-[13px]">
                {["booked", "arrived", "waiting", "in_visit", "done", "no_show", "cancelled"].map((status) => {
                  const count = dayList.filter((item) => item.status === status).length;
                  return (
                    <li key={status} className="flex items-center justify-between">
                      <StatusBadge status={status} />
                      <span className="font-bold text-slate-700">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="card card-pad">
              <h2 className="section-title mb-2">أسبوعك</h2>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }, (_, index) => addDays(date, index - 3)).map((day) => (
                  <Link
                    key={day}
                    href={`/appointments?date=${day}&view=day`}
                    className={`flex flex-col items-center rounded-lg py-1.5 text-[11px] ${
                      day === date ? "bg-brand-700 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{formatWeekday(day).slice(0, 3)}</span>
                    <span className="text-sm font-bold">{day.slice(8)}</span>
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      {view === "week" ? <WeekView clinicId={user.clinicId} date={date} currency={user.currency} /> : null}
      {view === "month" ? <MonthView clinicId={user.clinicId} date={date} /> : null}
    </div>
  );
}

async function WeekView({ clinicId, date, currency }: { clinicId: string; date: string; currency: string }) {
  const start = addDays(date, 0);
  const rows = await appointmentsInRange(clinicId, start, addDays(date, 6));
  const days = Array.from({ length: 7 }, (_, index) => addDays(date, index));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((day) => {
        const items = rows.filter((row) => row.starts_at.slice(0, 10) === day);
        return (
          <section key={day} className="card card-pad">
            <Link href={`/appointments?date=${day}&view=day`} className="mb-2 flex items-baseline justify-between hover:text-brand-700">
              <span className="text-[13px] font-bold text-slate-800">{formatWeekday(day)}</span>
              <span className="text-[11px] text-slate-400">{day.slice(5)}</span>
            </Link>
            {items.length === 0 ? (
              <p className="text-[11px] text-slate-400">لا مواعيد</p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link href={`/appointments/${item.id}`} className="block rounded-lg bg-slate-50 px-2 py-1.5 hover:bg-slate-100">
                      <span className="text-[11px] font-bold text-slate-700">{timeOf(item.starts_at)}</span>
                      <p className="truncate text-[11px] text-slate-600">{item.patient_name}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[10px] text-slate-400">{items.length} موعد</p>
          </section>
        );
      })}
      <p className="text-[11px] text-slate-400 sm:col-span-2 lg:col-span-4 xl:col-span-7">
        العملة المعروضة في التقارير: {currency}
      </p>
    </div>
  );
}

async function MonthView({ clinicId, date }: { clinicId: string; date: string }) {
  const month = date.slice(0, 7);
  const cells = monthGrid(month);
  const rows = await appointmentsInRange(clinicId, `${month}-01`, `${month}-31`);
  const counts = new Map<string, { total: number; names: string[] }>();
  rows.forEach((row) => {
    const day = row.starts_at.slice(0, 10);
    const entry = counts.get(day) ?? { total: 0, names: [] };
    entry.total += 1;
    if (entry.names.length < 2) entry.names.push(row.patient_name.split(" ")[0]);
    counts.set(day, entry);
  });

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 bg-slate-50 text-center text-[11px] font-semibold text-slate-500">
        {["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((day) => (
          <div key={day} className="px-1 py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          if (!cell) return <div key={`empty-${index}`} className="min-h-20 border-t border-l border-slate-100 bg-slate-50/40" />;
          const entry = counts.get(cell);
          const isToday = cell === todayISO();
          return (
            <Link
              key={cell}
              href={`/appointments?date=${cell}&view=day`}
              className="min-h-20 border-t border-l border-slate-100 p-1.5 transition hover:bg-brand-50/40"
            >
              <span className={`inline-grid size-6 place-items-center rounded-full text-[11px] font-bold ${isToday ? "bg-brand-700 text-white" : "text-slate-600"}`}>
                {cell.slice(8)}
              </span>
              {entry ? (
                <>
                  <span className="mt-1 block rounded bg-brand-50 px-1 py-0.5 text-[10px] font-semibold text-brand-800">{entry.total} موعد</span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-400">{entry.names.join("، ")}</span>
                </>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
