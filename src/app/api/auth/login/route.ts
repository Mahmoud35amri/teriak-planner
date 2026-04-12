import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { Role } from "@/lib/auth/roles";

export async function POST(req: NextRequest) {
  const body = await req.json() as { email?: string; password?: string };
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Email et mot de passe requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ success: false, error: "Identifiants invalides" }, { status: 401 });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return NextResponse.json({ success: false, error: "Identifiants invalides" }, { status: 401 });
  }

  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role as Role });

  // Log the action
  await prisma.activityLog.create({
    data: { userId: user.id, action: "LOGIN", details: `User ${user.email} logged in` },
  });

  return NextResponse.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
