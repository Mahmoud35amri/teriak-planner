import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { DEFAULT_GAMMES } from "@/lib/data/defaults";
import { GammesData } from "@/lib/data/types";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canViewBusinessData")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const record = await prisma.gammesProduits.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!record) {
    return NextResponse.json({ success: true, data: DEFAULT_GAMMES });
  }

  const data = JSON.parse(record.data) as GammesData;
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

  const body = await req.json() as { data: GammesData };
  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ success: false, error: "Données invalides" }, { status: 400 });
  }

  const existing = await prisma.gammesProduits.findFirst({ orderBy: { updatedAt: "desc" } });
  let record;

  if (existing) {
    record = await prisma.gammesProduits.update({
      where: { id: existing.id },
      data: { data: JSON.stringify(body.data) },
    });
  } else {
    record = await prisma.gammesProduits.create({
      data: { data: JSON.stringify(body.data) },
    });
  }

  await prisma.activityLog.create({
    data: { userId: session.id, action: "GAMMES_UPDATED", details: "Gammes produits mises à jour" },
  });

  return NextResponse.json({ success: true, data: JSON.parse(record.data), id: record.id });
}
