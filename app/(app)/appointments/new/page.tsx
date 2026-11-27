import { requireClinicUser, requirePerm } from "@/lib/auth";
import { all } from "@/lib/db";
import { doctorsFor } from "@/lib/queries";
import { todayISO } from "@/lib/format";
import AppointmentForm from "@/components/AppointmentForm";
import { PageHeader } from "@/components/ui";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; patientId?: string; time?: string }>;
}) {
  const user = await requireClinicUser();
  requirePerm(user, "appointments");
  const sp = await searchParams;

  const patients = await all<{ id: string; name: string; code: string; phone: string }>(
    "SELECT id, name, code, phone FROM patients WHERE clinic_id = ? ORDER BY name LIMIT 500",
    [user.clinicId],
  );
  const doctors = await doctorsFor(user.clinicId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="حجز موعد جديد" subtitle="سيتم التحقق تلقائياً من تعارض المواعيد لنفس الطبيب." />
      <AppointmentForm
        patients={patients}
        doctors={doctors}
        defaultDate={/^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? (sp.date as string) : todayISO()}
        defaultPatientId={sp.patientId}
        defaultTime={sp.time}
      />
    </div>
  );
}
