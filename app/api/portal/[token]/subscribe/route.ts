import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { get } from "@/lib/db";
import { portalCookieName, portalCookieValue } from "@/lib/portal";
import { getVapidKeys, subscribePatient } from "@/lib/push";

async function authorizedPatient(token: string) {
  const patient = await get<{ id: string }>("SELECT id FROM patients WHERE portal_token = ?", [token]);
  if (!patient) return null;
  const store = await cookies();
  const verified = store.get(portalCookieName(token))?.value === portalCookieValue(patient.id, token);
  return verified ? patient : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const patient = await authorizedPatient(token);
  if (!patient) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const keys = await getVapidKeys();
  return NextResponse.json({ publicKey: keys.publicKey }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const patient = await authorizedPatient(token);
  if (!patient) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  let data: unknown = null;
  try {
    data = await request.json();
  } catch {
    data = null;
  }
  const ok = await subscribePatient(patient.id, (data ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null });
  if (!ok) return NextResponse.json({ error: "بيانات اشتراك غير صالحة" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
