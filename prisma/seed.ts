import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_GAMMES, DEFAULT_OUVERTURE_LIGNES, DEFAULT_PDP } from "../src/lib/data/defaults";

const prisma = new PrismaClient();

async function main() {
  // Create default users
  const users = [
    { name: "Ahmed Planner", email: "planner@teriak.tn", password: "planner123", role: "PLANIFICATEUR" as const },
    { name: "Sara Atelier", email: "atelier@teriak.tn", password: "atelier123", role: "RESPONSABLE_ATELIER" as const },
    { name: "Admin Sys", email: "admin@teriak.tn", password: "admin123", role: "ADMINISTRATEUR" as const },
    { name: "Directeur DG", email: "direction@teriak.tn", password: "direction123", role: "DIRECTION" as const },
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, password: hashed, role: u.role },
    });
  }

  // Seed default data tables
  const gammesCount = await prisma.gammesProduits.count();
  if (gammesCount === 0) {
    await prisma.gammesProduits.create({ data: { data: JSON.stringify(DEFAULT_GAMMES) } });
  }

  const lignesCount = await prisma.ouvertureLignes.count();
  if (lignesCount === 0) {
    await prisma.ouvertureLignes.create({ data: { data: JSON.stringify(DEFAULT_OUVERTURE_LIGNES) } });
  }

  const pdpCount = await prisma.pDP.count();
  if (pdpCount === 0) {
    await prisma.pDP.create({ data: { name: "PDP 2026 (Défaut)", data: JSON.stringify(DEFAULT_PDP) } });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
