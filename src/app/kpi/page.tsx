import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import KPIClient from "./KPIClient";

export default async function KPIPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "canViewKPIs")) redirect("/dashboard");

  return <KPIClient />;
}
