import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import ChargeClient from "./ChargeClient";

export default async function ChargePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "canViewBusinessData")) redirect("/dashboard");

  const canSubmit = can(session.role, "canSubmitProposals");
  const canApprove = can(session.role, "canApproveProposals");

  return <ChargeClient canSubmit={canSubmit} canApprove={canApprove} />;
}
