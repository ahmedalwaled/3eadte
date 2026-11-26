import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { get, uploadsDir } from "@/lib/db";
import { portalCookieName, portalCookieValue } from "@/lib/portal";
import { cookies } from "next/headers";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;

  const patient = await get<{ id: string }>("SELECT id FROM patients WHERE portal_token = ?", [token]);
  if (!patient) return new NextResponse("الملف غير موجود", { status: 404 });

  const store = await cookies();
  const verified = store.get(portalCookieName(token))?.value === portalCookieValue(patient.id, token);
  if (!verified) return new NextResponse("غير مصرح", { status: 401 });

  const row = await get<{ stored_name: string; original_name: string; mime: string }>(
    "SELECT stored_name, original_name, mime FROM attachments WHERE id = ? AND patient_id = ? AND share_with_portal = 1",
    [id, patient.id],
  );
  if (!row) return new NextResponse("الملف غير موجود", { status: 404 });

  const buffer = await fs.readFile(path.join(uploadsDir(), row.stored_name)).catch(() => null);
  if (!buffer) return new NextResponse("الملف غير موجود", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": row.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
