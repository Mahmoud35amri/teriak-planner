import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { OuvertureLignesData, LigneParams } from "@/lib/data/types";
import { validateLigneParams } from "@/lib/data/constraints";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });

  const canSubmit = can(session.role, "canSubmitProposals");
  const canApprove = can(session.role, "canApproveProposals");
  if (!canSubmit && !canApprove) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const where = canApprove ? {} : { userId: session.id };
  const proposals = await prisma.proposal.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: proposals });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "canSubmitProposals")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json() as {
    workshop?: string;
    changes?: { weeks?: number; coeff?: number; shifts?: number; days?: number; hours?: number };
    note?: string;
  };
  const { workshop, changes, note } = body;

  if (!workshop || !changes || Object.keys(changes).length === 0) {
    return NextResponse.json({ success: false, error: "Atelier et au moins une modification requise" }, { status: 400 });
  }

  // Validate proposed changes against hard constraints
  const { valid, errors: constraintErrors } = validateLigneParams(changes as Partial<LigneParams>, workshop);
  if (!valid) {
    return NextResponse.json(
      { success: false, error: `Contraintes non respectées: ${constraintErrors.join("; ")}` },
      { status: 400 }
    );
  }

  const proposal = await prisma.proposal.create({
    data: {
      userId: session.id,
      workshop,
      changes: JSON.stringify({ ...changes, note: note?.trim() ?? "" }),
      status: "PENDING",
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.id,
      action: "PROPOSAL_SUBMIT",
      details: `Atelier ${workshop} — ${Object.entries(changes).map(([k, v]) => `${k}:${v}`).join(", ")}`,
    },
  });

  return NextResponse.json({ success: true, data: proposal });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "canApproveProposals")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json() as { id?: string; action?: "APPROVE" | "REJECT" };
  const { id, action } = body;
  if (!id || !action || !["APPROVE", "REJECT"].includes(action)) {
    return NextResponse.json({ success: false, error: "Données manquantes" }, { status: 400 });
  }

  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) return NextResponse.json({ success: false, error: "Proposition introuvable" }, { status: 404 });
  if (proposal.status !== "PENDING") {
    return NextResponse.json({ success: false, error: "Cette proposition a déjà été traitée" }, { status: 400 });
  }

  if (action === "APPROVE") {
    const lignesRecord = await prisma.ouvertureLignes.findFirst({ orderBy: { updatedAt: "desc" } });
    if (lignesRecord) {
      const data = JSON.parse(lignesRecord.data) as OuvertureLignesData;
      const raw = JSON.parse(proposal.changes) as Record<string, unknown>;
      const { note: _note, ...numeric } = raw;
      const currentLine = data[proposal.workshop as keyof OuvertureLignesData] ?? {
        weeks: 0, coeff: 1, shifts: 1, days: 7, hours: 7,
      };
      const merged = { ...currentLine, ...numeric } as LigneParams;

      // Re-validate merged params before applying
      const { valid: mergedValid, errors: mergedErrors } = validateLigneParams(merged, proposal.workshop);
      if (!mergedValid) {
        return NextResponse.json(
          { success: false, error: `Contraintes non respectées après fusion: ${mergedErrors.join("; ")}` },
          { status: 400 }
        );
      }

      data[proposal.workshop as keyof OuvertureLignesData] = merged;
      await prisma.ouvertureLignes.update({
        where: { id: lignesRecord.id },
        data: { data: JSON.stringify(data) },
      });
    }
  }

  const status = action === "APPROVE" ? "APPROVED" : "REJECTED";
  await prisma.proposal.update({ where: { id }, data: { status } });

  await prisma.activityLog.create({
    data: {
      userId: session.id,
      action: action === "APPROVE" ? "PROPOSAL_APPROVED" : "PROPOSAL_REJECTED",
      details: `Proposition ${id.slice(-6)} — Atelier ${proposal.workshop}`,
    },
  });

  return NextResponse.json({ success: true });
}
