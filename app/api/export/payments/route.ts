import { getCurrentUser, can } from "@/lib/auth";
import { paymentsInRange } from "@/lib/queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatShortDate, monthRange, todayISO } from "@/lib/format";

const METHOD_LABEL: Record<string, string> = { cash: "نقداً", card: "شبكة", transfer: "تحويل", insurance: "تأمين" };

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.clinicId) return new Response("غير مصرح", { status: 401 });
  if (!can(user, "finance")) return new Response("غير مصرح", { status: 403 });

  const params = new URL(request.url).searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? (params.get("month") as string) : todayISO().slice(0, 7);
  const fallback = monthRange(month);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get("from") ?? "") ? (params.get("from") as string) : fallback.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.get("to") ?? "") ? (params.get("to") as string) : fallback.to;

  const payments = await paymentsInRange(user.clinicId, from, to);
  const total = payments.reduce((sum, payment) => sum + Number(payment.amount) * Number(payment.rate || 1), 0);

  const body = toCsv(
    ["التاريخ", "المريض", "المبلغ", "العملة", "سعر الصرف", `المعادل بـ ${user.currency}`, "طريقة الدفع", "ملاحظة"],
    [
      ...payments.map((payment) => {
        const rate = Number(payment.rate || 1);
        return [
          formatShortDate(payment.paid_at),
          payment.patient_name,
          Number(payment.amount).toFixed(2),
          payment.currency || user.currency,
          rate.toFixed(4),
          (Number(payment.amount) * rate).toFixed(2),
          METHOD_LABEL[payment.method] ?? payment.method,
          payment.note,
        ];
      }),
      ["الإجمالي", "", "", user.currency, "", total.toFixed(2), "", ""],
    ],
  );

  return csvResponse(`payments-${from}-${to}.csv`, body);
}
