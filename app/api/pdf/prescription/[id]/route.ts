import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { patientById, prescriptionById } from "@/lib/queries";
import { age } from "@/lib/format";
import { prescriptionPdf, type PrescriptionItem } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.clinicId) return new NextResponse("غير مصرح", { status: 401 });

  const { id } = await params;
  const prescription = await prescriptionById(user.clinicId, id);
  if (!prescription) return new NextResponse("الوصفة غير موجودة", { status: 404 });

  const patient = await patientById(user.clinicId, prescription.patient_id);
  if (!patient) return new NextResponse("المريض غير موجود", { status: 404 });

  const clinic = await get<{ name: string; phone: string; address: string }>("SELECT name, phone, address FROM clinics WHERE id = ?", [user.clinicId]);

  let items: PrescriptionItem[] = [];
  try {
    items = JSON.parse(prescription.items);
  } catch {
    items = [];
  }

  const buffer = await prescriptionPdf({
    clinic: { name: clinic?.name ?? user.clinicName ?? "العيادة", phone: clinic?.phone, address: clinic?.address },
    patient: { name: patient.name, code: patient.code, phone: patient.phone, birth_date: patient.birth_date, age: age(patient.birth_date) },
    doctor: prescription.doctor_name,
    specialty: user.specialty,
    createdAt: prescription.created_at,
    reference: `Rx-${prescription.id.slice(0, 6).toUpperCase()}`,
    items,
    instructions: prescription.instructions,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="prescription-${prescription.id.slice(0, 8)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
