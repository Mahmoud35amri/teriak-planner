import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can, Role } from "@/lib/auth/roles";
import LogsClient from "./LogsClient";

export default async function AdminLogsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role as Role, "canViewLogs")) redirect("/dashboard");

  return <LogsClient />;
}
