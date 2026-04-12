import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { DEFAULT_GAMMES } from "@/lib/data/defaults";
import { GammesData } from "@/lib/data/types";
import GammesClient from "./GammesClient";

export default async function GammesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "canViewBusinessData")) redirect("/dashboard");

  const record = await prisma.gammesProduits.findFirst({ orderBy: { updatedAt: "desc" } });
  const data: GammesData = record ? (JSON.parse(record.data) as GammesData) : DEFAULT_GAMMES;
  const canEdit = can(session.role, "canManageGammes");

  return <GammesClient initialData={data} canEdit={canEdit} />;
}
