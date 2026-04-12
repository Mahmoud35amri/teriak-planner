import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { DEFAULT_PDP } from "@/lib/data/defaults";
import { PDPData } from "@/lib/data/types";
import PDPClient from "./PDPClient";

export default async function PDPPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "canViewBusinessData")) redirect("/dashboard");

  const record = await prisma.pDP.findFirst({ orderBy: { updatedAt: "desc" } });
  const data: PDPData = record ? (JSON.parse(record.data) as PDPData) : DEFAULT_PDP;
  const canEdit = can(session.role, "canEditPDP");

  return <PDPClient initialData={data} canEdit={canEdit} />;
}
