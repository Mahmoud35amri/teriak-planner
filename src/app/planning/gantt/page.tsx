import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import GanttClient from "./GanttClient";

export default async function GanttPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "canViewBusinessData")) redirect("/dashboard");

  const canRun = can(session.role, "canRunScheduler");
  return <GanttClient canRun={canRun} />;
}
