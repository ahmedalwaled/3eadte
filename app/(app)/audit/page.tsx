import { requireClinicUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "patient.create": "إضافة مريض",
  "patient.update": "تعديل مريض",
  "patient.delete": "حذف مريض",
  "attachment.upload": "رفع ملف",
  "attachment.delete": "حذف ملف",
  "attachment.share": "مشاركة ملف مع البوابة",
  "attachment.unshare": "إيقاف مشاركة ملف",
  "payment.create": "تسجيل دفعة",
  "payment.delete": "حذف دفعة",
  "expense.create": "تسجيل مصروف",
  "expense.delete": "حذف مصروف",
  "staff.activate": "تنشيط موظف",
  "staff.deactivate": "إيقاف موظف",
  "staff.perm": "تغيير صلاحيات",
  "clinic.create": "إنشاء عيادة",
  "clinic.toggle": "تغيير حالة عيادة",
};

export default async function AuditPage() {
  const user = await requireClinicUser(["doctor"]);
  const logs = all<{ id: string; user_name: string; action: string; details: string; created_at: string }>(
    "SELECT id, user_name, action, details, created_at FROM audit_logs WHERE clinic_id = ? ORDER BY created_at DESC LIMIT 200",
    [user.clinicId],
  );

  return (
    <div>
      <PageHeader title="سجل التدقيق" subtitle="آخر 200 عملية جرت في العيادة، بالتاريخ والمستخدم." />
      {logs.length === 0 ? (
        <EmptyState title="لا توجد عمليات مسجلة بعد" body="ستظهر هنا كل عمليات الإضافة والتعديل والحذف تلقائياً." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                <th className="px-3 py-2 font-semibold">الوقت</th>
                <th className="px-3 py-2 font-semibold">المستخدم</th>
                <th className="px-3 py-2 font-semibold">العملية</th>
                <th className="px-3 py-2 font-semibold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{formatDateTime(log.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{log.user_name || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{ACTION_LABEL[log.action] ?? log.action}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
