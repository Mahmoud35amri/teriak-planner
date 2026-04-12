import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canViewKPIs = can(session.role, "canViewKPIs");
  return <DashboardClient session={session} canViewKPIs={canViewKPIs} />;
}
