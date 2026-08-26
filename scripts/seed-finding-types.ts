// Seed default finding types + tags vocabulary. Idempotent.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const TYPES = [
  "SQL Injection",
  "XSS",
  "Broken Access Control",
  "Authentication Issue",
  "Misconfiguration",
  "Weak Credential",
  "Privilege Escalation",
  "Information Disclosure",
];

async function main() {
  for (const name of TYPES) {
    await db.findingType.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`finding types ensured: ${TYPES.length}`);
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
