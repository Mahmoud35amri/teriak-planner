import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can, Role } from "@/lib/auth/roles";
import UsersClient from "./UsersClient";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role as Role, "canManageUsers")) redirect("/dashboard");

  return <UsersClient />;
}
