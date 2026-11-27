import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get, uploadsDir } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.clinicId) return new NextResponse("غير مصرح", { status: 401 });

  const { id } = await params;
  const row = await get<{ stored_name: string; original_name: string; mime: string; content: Uint8Array | null }>(
    "SELECT stored_name, original_name, mime, content FROM attachments WHERE id = ? AND clinic_id = ?",
    [id, user.clinicId],
  );
  if (!row) return new NextResponse("الملف غير موجود", { status: 404 });

  const buffer = row.content
    ? Buffer.from(row.content)
    : row.stored_name
      ? await fs.readFile(path.join(uploadsDir(), row.stored_name)).catch(() => null)
      : null;
  if (!buffer) return new NextResponse("الملف غير موجود", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": row.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
