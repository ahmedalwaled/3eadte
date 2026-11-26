"use server";

import { revalidatePath } from "next/cache";
import { requireClinicUser } from "@/lib/auth";
import { run } from "@/lib/db";

export async function markAllRead() {
  const user = await requireClinicUser();
  run("UPDATE notifications SET is_read = 1 WHERE clinic_id = ?", [user.clinicId]);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markRead(formData: FormData) {
  const user = await requireClinicUser();
  const id = String(formData.get("id") ?? "");
  run("UPDATE notifications SET is_read = 1 WHERE id = ? AND clinic_id = ?", [id, user.clinicId]);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
