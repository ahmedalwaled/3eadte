import { notFound, redirect } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { patientById } from "@/lib/queries";
import { createVisit } from "@/lib/actions/visits";
import VisitForm from "@/components/VisitForm";
import { PageHeader } from "@/components/ui";

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClinicUser(["doctor"]);
  const { id } = await params;
  const patient = patientById(user.clinicId, id);
  if (!patient) notFound();
  if (user.role !== "doctor") redirect(`/patients/${id}`);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="زيارة جديدة" subtitle={`${patient.name} · ${patient.code}`} />
      <VisitForm
        action={createVisit}
        patientId={patient.id}
        patientName={patient.name}
        submitLabel="حفظ الزيارة"
        cancelHref={`/patients/${patient.id}`}
      />
    </div>
  );
}
