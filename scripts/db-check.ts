import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL }) });
  console.log("projections:", await p.projection.count());
  console.log("runs:", (await p.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 3 })).map(r => `${r.plan} ${r.status} ok=${r.fieldsOk} fail=${r.fieldsFailed}`));
  await p.$disconnect();
}
main();
