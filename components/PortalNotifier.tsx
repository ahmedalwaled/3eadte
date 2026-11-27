"use client";

import { useEffect, useState } from "react";

type State = "idle" | "busy" | "on" | "denied" | "error" | "unsupported";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PortalNotifier({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) setState("on");
        })
        .catch(() => undefined);
    }
  }, []);

  async function enable() {
    setState("busy");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const keyResponse = await fetch(`/api/portal/${token}/subscribe`);
      if (!keyResponse.ok) throw new Error("key");
      const { publicKey } = (await keyResponse.json()) as { publicKey: string };
      if (!publicKey) throw new Error("key");

      const existing = await reg.pushManager.getSubscription();
      const subscription =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        }));

      const saved = await fetch(`/api/portal/${token}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!saved.ok) throw new Error("save");

      const reminder = await fetch(`/api/portal/${token}/reminders`, { method: "POST" });
      if (reminder.ok) {
        const data = (await reminder.json()) as { sent?: number };
        if (data.sent) setMessage("وصل تذكير بموعدك القادم.");
      }
      setState("on");
    } catch {
      setState("error");
    }
  }

  if (state === "unsupported") {
    return (
      <p className="text-[11px] text-slate-500">
        متصفحك لا يدعم إشعارات التطبيق. أضف البوابة إلى الشاشة الرئيسية من قائمة المتصفح، وستصلك التذكيرات على الأجهزة الداعمة.
      </p>
    );
  }

  return (
    <div className="rounded-xl bg-brand-50 px-3 py-3">
      {state === "on" ? (
        <div>
          <p className="text-[13px] font-bold text-brand-900">الإشعارات مفعّلة</p>
          <p className="mt-0.5 text-[11px] text-brand-900/70">
            {message || "ستصلك تذكيرات المواعيد ورسائل العيادة حتى لو كان التطبيق مغلقًا."}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-[13px] font-bold text-brand-900">فعّل الإشعارات</p>
          <p className="mt-0.5 text-[11px] text-brand-900/70">
            ثبّت البوابة كتطبيق على جوالك (من قائمة المتصفح: إضافة إلى الشاشة الرئيسية) لتصلك تذكيرات المواعيد ورسائل الطبيب.
          </p>
          {state === "denied" && <p className="mt-1 text-[11px] font-semibold text-rose-800">الإذن مرفوض. اسمح بالإشعارات من إعدادات المتصفح لهذا الموقع ثم أعد المحاولة.</p>}
          {state === "error" && <p className="mt-1 text-[11px] font-semibold text-rose-800">تعذّر تفعيل الإشعارات. تأكد من اتصال الإنترنت وأعد المحاولة.</p>}
          <button onClick={enable} disabled={state === "busy"} className="btn-primary mt-2 !py-2 text-xs">
            {state === "busy" ? "جارٍ التفعيل…" : "تفعيل الإشعارات"}
          </button>
        </div>
      )}
    </div>
  );
}
