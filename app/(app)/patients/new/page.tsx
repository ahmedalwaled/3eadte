import { requireClinicUser } from "@/lib/auth";
import { createPatient } from "@/lib/actions/patients";
import PatientForm from "@/components/PatientForm";
import { PageHeader } from "@/components/ui";

export default async function NewPatientPage() {
  await requireClinicUser(["doctor", "secretary"]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="مريض جديد" subtitle="سيتم إنشاء ملف طبي مستقل ورقم ملف تلقائي." />
      <PatientForm action={createPatient} submitLabel="إنشاء الملف" />
    </div>
  );
}
