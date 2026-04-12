import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import ScenariosClient from "./ScenariosClient";

export default async function ScenariosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "canManageScenarios")) redirect("/dashboard");

  return <ScenariosClient canManage={can(session.role, "canManageScenarios")} />;
}
