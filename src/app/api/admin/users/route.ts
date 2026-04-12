import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth/session";
import { can, Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";

const VALID_ROLES: Role[] = ["PLANIFICATEUR", "RESPONSABLE_ATELIER", "ADMINISTRATEUR", "DIRECTION"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "canManageUsers")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: users });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "canManageUsers")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json() as { name?: string; email?: string; password?: string; role?: string };
  const { name, email, password, role } = body;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ success: false, error: "Nom, email et mot de passe requis" }, { status: 400 });
  }
  if (!role || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ success: false, error: "Rôle invalide" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (existing) {
    return NextResponse.json({ success: false, error: "Cet email est déjà utilisé" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name: name.trim(), email: email.trim(), password: hashed, role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.id,
      action: "USER_CREATED",
      details: `${user.email} — Rôle: ${role}`,
    },
  });

  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "canManageUsers")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json() as { id?: string; role?: string };
  const { id, role } = body;

  if (!id || !role || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ success: false, error: "ID et rôle valide requis" }, { status: 400 });
  }

  if (id === session.id) {
    return NextResponse.json({ success: false, error: "Vous ne pouvez pas modifier votre propre rôle" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    await prisma.activityLog.create({
      data: {
        userId: session.id,
        action: "USER_ROLE_CHANGED",
        details: `${user.email} → ${role}`,
      },
    });
    return NextResponse.json({ success: true, data: user });
  } catch {
    return NextResponse.json({ success: false, error: "Utilisateur introuvable" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "canManageUsers")) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "ID requis" }, { status: 400 });

  if (id === session.id) {
    return NextResponse.json({ success: false, error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
  }

  try {
    const user = await prisma.user.delete({ where: { id } });
    await prisma.activityLog.create({
      data: {
        userId: session.id,
        action: "USER_DELETED",
        details: `${user.email}`,
      },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Utilisateur introuvable" }, { status: 404 });
  }
}
