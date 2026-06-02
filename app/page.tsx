import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canUseAdmin } from "@/lib/permissions";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  redirect(canUseAdmin(user) ? "/admin/dashboard" : "/tickets");
}
