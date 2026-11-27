import { requireClinicUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { clinicCurrencies } from "@/lib/queries";
import { toggleStaff, togglePerm } from "@/lib/actions/settings";
import { ClinicForm, StaffForm } from "@/components/SettingsForms";
import CurrencySettings from "@/components/CurrencySettings";
import { PageHeader } from "@/components/ui";
import { formatDate, initials } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireClinicUser(["doctor"]);
  const clinic = await get<{ name: string; phone: string; address: string; currency: string }>(
    "SELECT name, phone, address, currency FROM clinics WHERE id = ?",
    [user.clinicId],
  );
  const staff = await all<{ id: string; name: string; email: string; role: string; specialty: string; active: number; denied_perms: string; created_at: string }>(
    "SELECT id, name, email, role, specialty, active, denied_perms, created_at FROM users WHERE clinic_id = ? ORDER BY role, name",
    [user.clinicId],
  );
  const PERM_LABELS: Record<string, string> = {
    appointments: "المواعيد",
    patients: "المرضى",
    finance: "المالية",
    reports: "التقارير",
    uploads: "رفع الملفات",
  };

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="بيانات العيادة والمستخدمون والصلاحيات" />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="section-title mb-3">بيانات العيادة</h2>
          <ClinicForm clinic={clinic ?? { name: "", phone: "", address: "", currency: "SYP" }} />
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3">إضافة مستخدم</h2>
          <StaffForm />
        </section>

        <div className="lg:col-span-2">
          <CurrencySettings base={clinic?.currency ?? user.currency} currencies={await clinicCurrencies(user.clinicId)} />
        </div>

        <section className="card card-pad lg:col-span-2">
          <h2 className="section-title mb-3">المستخدمون ({staff.length})</h2>
          <ul className="divide-y divide-slate-100">
            {staff.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-800">{initials(member.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {member.name}
                    {member.id === user.id ? <span className="ms-2 text-[10px] font-semibold text-brand-700">(أنت)</span> : null}
                  </p>
                  <p className="truncate text-[11px] text-slate-500" dir="ltr">
                    {member.email}
                  </p>
                </div>
                <span className="badge bg-slate-100 text-slate-600 ring-slate-200">
                  {member.role === "doctor" ? `طبيب${member.specialty ? ` · ${member.specialty}` : ""}` : "سكرتيرة"}
                </span>
                <span className={`badge ${member.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
                  {member.active ? "مفعّل" : "موقوف"}
                </span>
                {member.role === "secretary" && member.active ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(PERM_LABELS).map(([perm, label]) => {
                      const granted = !member.denied_perms.split(",").filter(Boolean).includes(perm);
                      return (
                        <form key={perm} action={togglePerm}>
                          <input type="hidden" name="id" value={member.id} />
                          <input type="hidden" name="perm" value={perm} />
                          <button
                            className={`badge cursor-pointer ${granted ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-400 ring-slate-200"}`}
                            title={granted ? "اضغط لسحب الصلاحية" : "اضغط لمنح الصلاحية"}
                          >
                            {label}
                          </button>
                        </form>
                      );
                    })}
                    <span className="text-[11px] leading-5 text-slate-500">
                      اضغط على أي صلاحية لمنحها أو سحبها — تحدد ما يظهر للسكرتيرة في القائمة ولوحة التحكم.
                    </span>
                  </div>
                ) : null}
                <span className="hidden text-[11px] text-slate-400 sm:block">منذ {formatDate(member.created_at.slice(0, 10))}</span>
                {member.id !== user.id ? (
                  <form action={toggleStaff}>
                    <input type="hidden" name="id" value={member.id} />
                    <button className="text-xs font-semibold text-slate-500 hover:text-brand-700">{member.active ? "إيقاف" : "تفعيل"}</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
