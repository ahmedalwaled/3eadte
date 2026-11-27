import { requireClinicUser, requirePerm } from "@/lib/auth";
import { createPatient } from "@/lib/actions/patients";
import PatientForm from "@/components/PatientForm";
import { PageHeader } from "@/components/ui";

export default async function NewPatientPage() {
  const user = await requireClinicUser(["doctor", "secretary"]);
  requirePerm(user, "patients");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="مريض جديد" subtitle="سيتم إنشاء ملف طبي مستقل ورقم ملف تلقائي." />
      <PatientForm action={createPatient} submitLabel="إنشاء الملف" />
    </div>
  );
}
