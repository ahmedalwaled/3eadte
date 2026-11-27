import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { patientBalance, patientById, paymentLedger, visitsForPatient } from "@/lib/queries";
import { age, money } from "@/lib/format";
import { statementPdf, type StatementRow } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const METHOD_LABEL: Record<string, string> = { cash: "نقداً", card: "شبكة", transfer: "تحويل", insurance: "تأمين" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.clinicId) return new NextResponse("غير مصرح", { status: 401 });

  const { id } = await params;
  const patient = await patientById(user.clinicId, id);
  if (!patient) return new NextResponse("المريض غير موجود", { status: 404 });

  const url = new URL(request.url);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") ?? "") ? (url.searchParams.get("from") as string) : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") ?? "") ? (url.searchParams.get("to") as string) : "";
  const inRange = (date: string) => {
    const day = date.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  };

  const clinic = await get<{ name: string; phone: string; address: string }>("SELECT name, phone, address FROM clinics WHERE id = ?", [user.clinicId]);
  const visits = (await visitsForPatient(user.clinicId, id)).filter((visit) => inRange(visit.visit_date));
  const payments = (await paymentLedger(user.clinicId, id, user.currency)).filter((payment) => inRange(payment.paid_at));
  const balance = await patientBalance(user.clinicId, id);

  type Entry = { date: string; kind: "visit" | "payment"; label: string; charge: number; credit: number; rate: number };
  const entries: Entry[] = [
    ...visits.map<Entry>((visit) => ({
      date: visit.visit_date,
      kind: "visit",
      label: visit.diagnosis ? `زيارة — ${visit.diagnosis}` : "زيارة",
      charge: Number(visit.fee) - Number(visit.discount),
      credit: 0,
      rate: 1,
    })),
    ...payments.map<Entry>((payment) => ({
      date: payment.paid_at,
      kind: "payment",
      label: `دفعة — ${METHOD_LABEL[payment.method] ?? payment.method}${payment.note ? ` · ${payment.note}` : ""}`,
      charge: 0,
      credit: Number(payment.amount),
      rate: Number(payment.rate || 1),
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === "visit" ? -1 : 1));

  let running = 0;
  const rows: StatementRow[] = entries.map((entry) => {
    running += entry.charge - entry.credit * entry.rate;
    return {
      date: entry.date,
      label: entry.label,
      charge: entry.charge ? money(entry.charge, user.currency) : "—",
      credit: entry.credit ? money(entry.credit * entry.rate, user.currency) : "—",
      balance: running,
    };
  });

  const due = entries.reduce((sum, entry) => sum + entry.charge, 0);
  const paidBase = entries.reduce((sum, entry) => sum + entry.credit * entry.rate, 0);

  const buffer = await statementPdf({
    clinic: { name: clinic?.name ?? user.clinicName ?? "العيادة", phone: clinic?.phone, address: clinic?.address },
    patient: { name: patient.name, code: patient.code, phone: patient.phone, birth_date: patient.birth_date, age: age(patient.birth_date) },
    currency: user.currency,
    from,
    to,
    rows,
    due,
    paid: paidBase,
    balance: Number(balance.outstanding),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="statement-${patient.code || patient.id.slice(0, 8)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
