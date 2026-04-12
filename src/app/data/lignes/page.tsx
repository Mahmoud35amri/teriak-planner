import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { DEFAULT_OUVERTURE_LIGNES } from "@/lib/data/defaults";
import { OuvertureLignesData } from "@/lib/data/types";
import LignesClient from "./LignesClient";

export default async function LignesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "canViewBusinessData")) redirect("/dashboard");

  const record = await prisma.ouvertureLignes.findFirst({ orderBy: { updatedAt: "desc" } });
  const data: OuvertureLignesData = record
    ? (JSON.parse(record.data) as OuvertureLignesData)
    : DEFAULT_OUVERTURE_LIGNES;
  const canEdit = can(session.role, "canManageGammes");

  return <LignesClient initialData={data} canEdit={canEdit} />;
}
