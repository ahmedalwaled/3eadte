import { notFound, redirect } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { appointmentById, patientById } from "@/lib/queries";
import { createVisit } from "@/lib/actions/visits";
import VisitForm from "@/components/VisitForm";
import { PageHeader } from "@/components/ui";

export default async function AppointmentVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClinicUser(["doctor"]);
  const { id } = await params;
  const appointment = await appointmentById(user.clinicId, id);
  if (!appointment) notFound();
  if (appointment.status === "cancelled") redirect("/appointments");
  if (appointment.visit_id) redirect(`/visits/${appointment.visit_id}`);

  const patient = await patientById(user.clinicId, appointment.patient_id);
  if (!patient) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="بدء الزيارة"
        subtitle={`${patient.name} · موعد ${appointment.starts_at.slice(11, 16)} — ${appointment.reason || "بدون سبب محدد"}`}
      />
      <VisitForm
        action={createVisit}
        patientId={patient.id}
        patientName={patient.name}
        appointmentId={appointment.id}
        submitLabel="حفظ وإنهاء الزيارة"
        cancelHref="/dashboard"
      />
    </div>
  );
}
