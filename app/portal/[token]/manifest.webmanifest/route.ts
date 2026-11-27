import { NextResponse } from "next/server";
import { get } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const patient = await get<{ name: string; clinic_id: string }>("SELECT name, clinic_id FROM patients WHERE portal_token = ?", [token]);
  if (!patient) return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });

  const clinic = await get<{ name: string }>("SELECT name FROM clinics WHERE id = ?", [patient.clinic_id]);
  const name = `بوابة ${patient.name} — ${clinic?.name ?? "العيادة"}`;

  return NextResponse.json(
    {
      name,
      short_name: "بوابة المريض",
      description: `بوابة المريض ${patient.name} في ${clinic?.name ?? "العيادة"}: المواعيد والتقارير والوصفات.`,
      start_url: `/portal/${token}`,
      scope: `/portal/${token}`,
      display: "standalone",
      orientation: "portrait",
      dir: "rtl",
      lang: "ar",
      background_color: "#ffffff",
      theme_color: "#036b5a",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
