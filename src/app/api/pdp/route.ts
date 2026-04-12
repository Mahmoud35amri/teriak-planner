import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { DEFAULT_PDP } from "@/lib/data/defaults";
import { PDPData } from "@/lib/data/types";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canViewBusinessData")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const record = await prisma.pDP.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!record) {
    return NextResponse.json({ success: true, data: DEFAULT_PDP, id: null, name: "PDP 2026" });
  }

  const data = JSON.parse(record.data) as PDPData;
  return NextResponse.json({ success: true, data, id: record.id, name: record.name });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  }
  if (!can(session.role, "canEditPDP")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json() as { data: PDPData; name?: string };
  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ success: false, error: "Données invalides" }, { status: 400 });
  }

  const existing = await prisma.pDP.findFirst({ orderBy: { updatedAt: "desc" } });
  let record;

  if (existing) {
    record = await prisma.pDP.update({
      where: { id: existing.id },
      data: { data: JSON.stringify(body.data), name: body.name ?? existing.name },
    });
  } else {
    record = await prisma.pDP.create({
      data: { name: body.name ?? "PDP 2026", data: JSON.stringify(body.data) },
    });
  }

  await prisma.activityLog.create({
    data: { userId: session.id, action: "PDP_UPDATED", details: `PDP mis à jour: ${record.name}` },
  });

  return NextResponse.json({ success: true, data: JSON.parse(record.data), id: record.id, name: record.name });
}
