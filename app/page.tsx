import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export default async function HomePage() {
  ensureSeed();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "platform_admin" ? "/admin" : "/dashboard");
}
