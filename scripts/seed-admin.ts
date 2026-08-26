import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL!;
const password = process.env.ADMIN_PASSWORD!;
const name = process.env.ADMIN_NAME ?? "Admin";
const username = process.env.ADMIN_USERNAME ?? name.toLowerCase().replace(/\s+/g, "");

if (!email || !password) {
  console.error("Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed");
  process.exit(1);
}

async function main() {
  const existing = await prisma.user.findFirst();
  if (existing) {
    // ponytail: one-off repairs for rows created before username/issuer fields existed
    const patch: { username?: string; displayUsername?: string } = {};
    if (!existing.username) {
      patch.username = username;
    }
    if (!existing.displayUsername) {
      patch.displayUsername = username;
    }
    if (Object.keys(patch).length) {
      await prisma.user.update({ where: { id: existing.id }, data: patch });
      console.log(`Backfilled username "${username}" for ${existing.email}`);
    }
    // better-auth convention: credential account_id = user id, issuer = "local:credential"
    await prisma.account.updateMany({
      where: { userId: existing.id, providerId: "credential", OR: [{ issuer: null }, { accountId: { not: existing.id } }] },
      data: { issuer: "local:credential", accountId: existing.id },
    });
    console.log(`Users exist (${existing.email}) — ensured credential issuer`);
    return;
  }
  const user = await prisma.user.create({
    data: {
      name,
      email,
      emailVerified: true,
      role: "admin",
      username,
      displayUsername: username,
    },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      issuer: "local:credential",
      password: await hashPassword(password),
    },
  });
  console.log(`Created first admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
