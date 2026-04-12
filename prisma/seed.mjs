import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_GAMMES = {
  P1:  { production: { A:6, B:26, I:95.09 }, cleaning: { A:1.33, B:2.67, I:0 } },
  P2:  { production: { A:0, B:26, C:68, I:95.09 }, cleaning: { A:0, B:2.67, C:6, I:0 } },
  P3:  { production: { A:6, B:13, C:68, I:95.09 }, cleaning: { A:1.33, B:1.33, C:6, I:0 } },
  P4:  { production: { B:26, D:57.6, I:95.09 }, cleaning: { B:2.67, D:4, I:0 } },
  P5:  { production: { B:26, C:68, I:95.09 }, cleaning: { B:2.67, C:6, I:0 } },
  P6:  { production: { E:14.4, F:6, G:25.38, H:16.14, J:15.84 }, cleaning: { E:1.6, F:0.67, G:0, H:0, J:0 } },
  P7:  { production: { E:14.4, G:25.38, H:16.14, J:15.84 }, cleaning: { E:1.6, G:0, H:0, J:0 } },
  P8:  { production: {}, cleaning: {} },
  P9:  { production: { E:14.4, F:6, G:25.38, H:16.14, J:15.84 }, cleaning: { E:1.6, F:0.67, G:0, H:0, J:0 } },
  P10: { production: { C:160, I:95.09 }, cleaning: { C:8, I:0 } },
  P11: { production: { A:6, B:13, I:95.09 }, cleaning: { A:1.33, B:1.33, I:0 } },
  P12: { production: { E:14.4, G:25.38, H:16.14, J:15.84 }, cleaning: { E:1.6, G:0, H:0, J:0 } },
  P13: { production: { E:28.8, G:25.38, H:16.14, J:15.84 }, cleaning: { E:3.2, G:0, H:0, J:0 } },
};

const DEFAULT_LIGNES = {
  A: { weeks:4.2, coeff:1.0,  shifts:1, days:7, hours:7 },
  B: { weeks:4.2, coeff:0.85, shifts:3, days:7, hours:7 },
  C: { weeks:4.2, coeff:0.85, shifts:2, days:5, hours:7 },
  D: { weeks:4.2, coeff:0.85, shifts:2, days:6, hours:7 },
  E: { weeks:4.2, coeff:0.85, shifts:3, days:7, hours:7 },
  F: { weeks:4.2, coeff:0.85, shifts:3, days:7, hours:7 },
  G: { weeks:4.2, coeff:0.85, shifts:1, days:5, hours:7 },
  H: { weeks:4.2, coeff:0.85, shifts:1, days:5, hours:7 },
  I: { weeks:4.2, coeff:0.85, shifts:2, days:5, hours:7 },
  J: { weeks:4.2, coeff:0.85, shifts:3, days:6, hours:7 },
};

// Realistic pharma PDP — creates bottlenecks on Line I (Mar/May/Oct/Nov) and Line G (Mar/Nov)
const DEFAULT_PDP = {
  P1:  { jan:1, feb:1, mar:1, apr:1, may:1, jun:1, jul:0, aug:0, sep:1, oct:1, nov:1, dec:1 },
  P2:  { jan:1, feb:0, mar:1, apr:0, may:1, jun:0, jul:0, aug:0, sep:0, oct:1, nov:0, dec:1 },
  P3:  { jan:0, feb:1, mar:0, apr:1, may:0, jun:0, jul:0, aug:0, sep:1, oct:0, nov:1, dec:0 },
  P4:  { jan:0, feb:0, mar:1, apr:0, may:0, jun:1, jul:0, aug:0, sep:0, oct:0, nov:0, dec:0 },
  P5:  { jan:0, feb:0, mar:0, apr:0, may:1, jun:0, jul:0, aug:0, sep:0, oct:0, nov:1, dec:0 },
  P6:  { jan:1, feb:1, mar:2, apr:1, may:1, jun:1, jul:0, aug:0, sep:1, oct:1, nov:2, dec:1 },
  P7:  { jan:1, feb:1, mar:1, apr:1, may:0, jun:1, jul:0, aug:0, sep:1, oct:1, nov:1, dec:0 },
  P8:  { jan:0, feb:0, mar:0, apr:0, may:0, jun:0, jul:0, aug:0, sep:0, oct:0, nov:0, dec:0 },
  P9:  { jan:1, feb:0, mar:1, apr:1, may:1, jun:0, jul:0, aug:0, sep:1, oct:1, nov:1, dec:1 },
  P10: { jan:0, feb:0, mar:1, apr:0, may:0, jun:0, jul:0, aug:0, sep:0, oct:0, nov:0, dec:0 },
  P11: { jan:0, feb:0, mar:0, apr:0, may:0, jun:0, jul:0, aug:0, sep:0, oct:1, nov:0, dec:0 },
  P12: { jan:1, feb:1, mar:1, apr:1, may:0, jun:1, jul:0, aug:0, sep:0, oct:1, nov:1, dec:1 },
  P13: { jan:0, feb:1, mar:1, apr:0, may:1, jun:0, jul:0, aug:0, sep:1, oct:0, nov:1, dec:0 },
};

// Initial users — change passwords after first login
const INITIAL_USERS = [
  { name: "Planificateur",        email: "planificateur@teriak.tn", password: "Teriak@2026!", role: "PLANIFICATEUR" },
  { name: "Responsable Atelier",  email: "atelier@teriak.tn",       password: "Teriak@2026!", role: "RESPONSABLE_ATELIER" },
  { name: "Administrateur",       email: "admin@teriak.tn",         password: "Teriak@2026!", role: "ADMINISTRATEUR" },
  { name: "Direction",            email: "direction@teriak.tn",     password: "Teriak@2026!", role: "DIRECTION" },
];

async function main() {
  for (const u of INITIAL_USERS) {
    const hashed = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, password: hashed, role: u.role },
    });
  }

  const gammesCount = await prisma.gammesProduits.count();
  if (gammesCount === 0) {
    await prisma.gammesProduits.create({ data: { data: JSON.stringify(DEFAULT_GAMMES) } });
  }

  const lignesCount = await prisma.ouvertureLignes.count();
  if (lignesCount === 0) {
    await prisma.ouvertureLignes.create({ data: { data: JSON.stringify(DEFAULT_LIGNES) } });
  }

  const existingPdp = await prisma.pDP.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existingPdp) {
    await prisma.pDP.update({ where: { id: existingPdp.id }, data: { data: JSON.stringify(DEFAULT_PDP) } });
  } else {
    await prisma.pDP.create({ data: { name: "PDP 2026", data: JSON.stringify(DEFAULT_PDP) } });
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
