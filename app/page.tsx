import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canUseAdmin } from "@/lib/permissions";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect(canUseAdmin(user) ? "/admin/tickets" : "/tickets");
}
