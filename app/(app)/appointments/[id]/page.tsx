import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { appointmentById, patientById } from "@/lib/queries";
import { formatDate, timeOf } from "@/lib/format";
import { deleteAppointment, updateAppointmentStatus } from "@/lib/actions/appointments";
import { PageHeader, StatusBadge } from "@/components/ui";
import RescheduleForm from "@/components/RescheduleForm";

export const dynamic = "force-dynamic";

const FLOW: { status: string; label: string }[] = [
  { status: "arrived", label: "تأكيد الحضور" },
  { status: "waiting", label: "في الانتظار" },
  { status: "in_visit", label: "بدء المعاينة" },
  { status: "no_show", label: "لم يحضر" },
  { status: "cancelled", label: "إلغاء الموعد" },
];

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClinicUser();
  const { id } = await params;
  const appointment = await appointmentById(user.clinicId, id);
  if (!appointment) notFound();
  const patient = await patientById(user.clinicId, appointment.patient_id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="تفاصيل الموعد"
        subtitle={`${formatDate(appointment.starts_at.slice(0, 10))} · ${timeOf(appointment.starts_at)}`}
        actions={
          <>
            <Link href={`/patients/${appointment.patient_id}`} className="btn-ghost">
              ملف المريض
            </Link>
            {appointment.visit_id ? (
              <Link href={`/visits/${appointment.visit_id}`} className="btn-primary">
                فتح الزيارة
              </Link>
            ) : appointment.status !== "cancelled" && user.role === "doctor" ? (
              <Link href={`/appointments/${appointment.id}/visit`} className="btn-primary">
                بدء الزيارة
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card card-pad">
          <h2 className="section-title mb-2">المريض</h2>
          <p className="text-sm font-bold text-slate-800">{appointment.patient_name}</p>
          <p className="mt-0.5 text-xs text-slate-500" dir="ltr">
            {appointment.patient_phone}
          </p>
          {patient ? <p className="mt-2 text-[11px] text-slate-400">ملف {patient.code}</p> : null}
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-2">الحالة</h2>
          <StatusBadge status={appointment.status} />
          <p className="mt-2 text-xs text-slate-500">
            {appointment.reason || "بدون سبب محدد"} · {appointment.duration} دقيقة · {appointment.doctor_name}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FLOW.filter((item) => item.status !== appointment.status).map((item) => (
              <form key={item.status} action={updateAppointmentStatus}>
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="status" value={item.status} />
                <button
                  className={`!px-2.5 !py-1 text-[11px] ${item.status === "cancelled" || item.status === "no_show" ? "btn-danger" : "btn-ghost"}`}
                >
                  {item.label}
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-2">تعديل الموعد</h2>
          <RescheduleForm
            id={appointment.id}
            date={appointment.starts_at.slice(0, 10)}
            time={timeOf(appointment.starts_at)}
            duration={appointment.duration}
          />
        </section>

        {user.role === "doctor" ? (
          <section className="card card-pad">
            <h2 className="section-title mb-2">إدارة</h2>
            <p className="mb-2 text-[11px] text-slate-500">حذف الموعد نهائياً من السجل.</p>
            <form action={deleteAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <button className="btn-danger w-full !py-2 text-xs">حذف الموعد</button>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}
