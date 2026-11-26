import { requireClinicUser } from "@/lib/auth";
import { notificationsFor } from "@/lib/queries";
import { markAllRead, markRead } from "@/lib/actions/notifications";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const KIND_STYLE: Record<string, string> = {
  appointment: "bg-sky-500",
  warning: "bg-rose-500",
  info: "bg-brand-500",
};

export default async function NotificationsPage() {
  const user = await requireClinicUser();
  const items = notificationsFor(user.clinicId, 50);
  const unread = items.filter((item) => !item.is_read).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="الإشعارات"
        subtitle={`${unread} إشعاراً غير مقروء`}
        actions={
          unread > 0 ? (
            <form action={markAllRead}>
              <button className="btn-ghost">تعليم الكل كمقروء</button>
            </form>
          ) : null
        }
      />

      {items.length === 0 ? (
        <EmptyState title="لا إشعارات" body="ستظهر هنا تنبيهات المواعيد والحضور والحجوزات." />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className={`card card-pad flex gap-3 ${item.is_read ? "" : "ring-brand-200"}`}>
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${KIND_STYLE[item.kind] ?? "bg-slate-400"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm ${item.is_read ? "font-semibold text-slate-600" : "font-bold text-slate-900"}`}>{item.title}</p>
                  <span className="shrink-0 text-[10px] text-slate-400">{formatDate(item.created_at.slice(0, 10))}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-slate-500">{item.body}</p>
              </div>
              {!item.is_read ? (
                <form action={markRead}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="text-[11px] font-semibold text-brand-700 hover:underline">مقروء</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
