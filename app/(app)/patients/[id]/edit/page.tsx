import { notFound } from "next/navigation";
import { requireClinicUser } from "@/lib/auth";
import { patientById } from "@/lib/queries";
import { updatePatient } from "@/lib/actions/patients";
import PatientForm from "@/components/PatientForm";
import { PageHeader } from "@/components/ui";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClinicUser(["doctor", "secretary"]);
  const { id } = await params;
  const patient = patientById(user.clinicId, id);
  if (!patient) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="تعديل بيانات المريض" subtitle={`${patient.name} · ${patient.code}`} />
      <PatientForm action={updatePatient} patient={patient} submitLabel="حفظ التعديلات" />
    </div>
  );
}
