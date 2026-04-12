import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { DEFAULT_OUVERTURE_LIGNES } from "@/lib/data/defaults";
import { ALL_LINES, OuvertureLignesData } from "@/lib/data/types";
import { validateLigneParams } from "@/lib/data/constraints";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canViewBusinessData")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const record = await prisma.ouvertureLignes.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!record) {
    return NextResponse.json({ success: true, data: DEFAULT_OUVERTURE_LIGNES });
  }

  const data = JSON.parse(record.data) as OuvertureLignesData;
  return NextResponse.json({ success: true, data, id: record.id });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canManageGammes")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json() as { data: OuvertureLignesData };
  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ success: false, error: "Données invalides" }, { status: 400 });
  }

  // Validate each line's params against hard constraints
  const allErrors: string[] = [];
  for (const line of ALL_LINES) {
    const params = body.data[line];
    if (!params) {
      allErrors.push(`Atelier ${line}: données manquantes`);
      continue;
    }
    const { valid, errors } = validateLigneParams(params, line);
    if (!valid) allErrors.push(...errors);
  }
  if (allErrors.length > 0) {
    return NextResponse.json(
      { success: false, error: `Contraintes non respectées: ${allErrors.join("; ")}` },
      { status: 400 }
    );
  }

  const existing = await prisma.ouvertureLignes.findFirst({ orderBy: { updatedAt: "desc" } });
  let record;

  if (existing) {
    record = await prisma.ouvertureLignes.update({
      where: { id: existing.id },
      data: { data: JSON.stringify(body.data) },
    });
  } else {
    record = await prisma.ouvertureLignes.create({
      data: { data: JSON.stringify(body.data) },
    });
  }

  await prisma.activityLog.create({
    data: { userId: session.id, action: "LIGNES_UPDATED", details: "Ouverture lignes mise à jour" },
  });

  return NextResponse.json({ success: true, data: JSON.parse(record.data), id: record.id });
}
