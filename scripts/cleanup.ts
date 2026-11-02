import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  await db.message.deleteMany({});
  await db.conversation.deleteMany({});
  await db.learning.deleteMany({});
  await db.setting.update({ where: { id: "default" }, data: { colabUrl: null, colabSecret: null } });
  console.log("Limpieza OK");
}
main().finally(() => db.$disconnect());
