import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { Role } from "@/lib/auth/roles";
import ProposalsClient from "./ProposalsClient";

export default async function ProposalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canSubmit = can(session.role as Role, "canSubmitProposals");
  const canApprove = can(session.role as Role, "canApproveProposals");
  if (!canSubmit && !canApprove) redirect("/dashboard");

  return <ProposalsClient canSubmit={canSubmit} canApprove={canApprove} />;
}
