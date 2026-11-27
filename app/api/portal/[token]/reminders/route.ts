import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { get, nowIso, run } from "@/lib/db";
import { portalCookieName, portalCookieValue } from "@/lib/portal";
import { sendPushToPatient } from "@/lib/push";
import { formatDate, timeOf } from "@/lib/format";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const patient = await get<{ id: string; clinic_id: string }>("SELECT id, clinic_id FROM patients WHERE portal_token = ?", [token]);
  if (!patient) return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });

  const store = await cookies();
  const verified = store.get(portalCookieName(token))?.value === portalCookieValue(patient.id, token);
  if (!verified) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const from = new Date().toISOString().slice(0, 16);
  const to = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const upcoming = await get<{ id: string; starts_at: string; reason: string }>(
    `SELECT a.id, a.starts_at, a.reason FROM appointments a
      WHERE a.patient_id = ? AND a.status = 'booked' AND a.starts_at >= ? AND a.starts_at <= ?
        AND NOT EXISTS (SELECT 1 FROM portal_reminders r WHERE r.patient_id = a.patient_id AND r.appointment_id = a.id)
      ORDER BY a.starts_at LIMIT 1`,
    [patient.id, from, to],
  );
  if (!upcoming) return NextResponse.json({ sent: 0 });

  const clinic = await get<{ name: string }>("SELECT name FROM clinics WHERE id = ?", [patient.clinic_id]);
  const sent = await sendPushToPatient(patient.id, {
    title: "تذكير بموعدك القريب",
    body: `${clinic?.name ?? "العيادة"}: موعدك ${formatDate(upcoming.starts_at.slice(0, 10))} الساعة ${timeOf(upcoming.starts_at)}${upcoming.reason ? ` — ${upcoming.reason}` : ""}`,
    url: `/portal/${token}`,
  });
  if (sent > 0) {
    await run("INSERT INTO portal_reminders (patient_id, appointment_id, sent_at) VALUES (?,?,?) ON CONFLICT DO NOTHING", [
      patient.id,
      upcoming.id,
      nowIso(),
    ]);
  }
  return NextResponse.json({ sent });
}
