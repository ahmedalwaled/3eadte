import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { patientById } from "@/lib/queries";
import { age } from "@/lib/format";
import { receiptPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const METHOD_LABEL: Record<string, string> = { cash: "نقداً", card: "شبكة", transfer: "تحويل", insurance: "تأمين" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.clinicId) return new NextResponse("غير مصرح", { status: 401 });

  const { id } = await params;
  const payment = await get<{
    id: string;
    amount: number;
    currency: string;
    rate: number;
    method: string;
    note: string | null;
    paid_at: string;
    patient_id: string;
  }>(
    "SELECT id, amount, currency, COALESCE(rate, 1) AS rate, method, note, paid_at, patient_id FROM payments WHERE clinic_id = ? AND id = ?",
    [user.clinicId, id],
  );
  if (!payment) return new NextResponse("الدفعة غير موجودة", { status: 404 });

  const patient = await patientById(user.clinicId, payment.patient_id);
  if (!patient) return new NextResponse("المريض غير موجود", { status: 404 });

  const clinic = await get<{ name: string; phone: string; address: string }>("SELECT name, phone, address FROM clinics WHERE id = ?", [user.clinicId]);

  const buffer = await receiptPdf({
    clinic: { name: clinic?.name ?? user.clinicName ?? "العيادة", phone: clinic?.phone, address: clinic?.address },
    patient: { name: patient.name, code: patient.code, phone: patient.phone, birth_date: patient.birth_date, age: age(patient.birth_date) },
    baseCurrency: user.currency,
    payment: {
      amount: Number(payment.amount),
      currency: payment.currency || user.currency,
      rate: Number(payment.rate || 1),
      method: METHOD_LABEL[payment.method] ?? payment.method,
      note: payment.note,
      paid_at: payment.paid_at,
      reference: `INV-${payment.id.slice(0, 6).toUpperCase()}`,
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="receipt-${payment.id.slice(0, 8)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
