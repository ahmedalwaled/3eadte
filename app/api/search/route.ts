import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth";
import { globalSearch } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.clinicId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 1) return NextResponse.json({ hits: [], ms: 0 });

  const started = Date.now();
  const hits = await globalSearch(user.clinicId, q, {
    patients: can(user, "patients"),
    appointments: can(user, "appointments"),
    finance: can(user, "finance"),
  });
  return NextResponse.json(
    { hits, ms: Date.now() - started },
    { headers: { "Cache-Control": "no-store" } },
  );
}
