import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const main = async () => {
  const result = await prisma.$queryRaw`select 1 as ok`;
  console.log(JSON.stringify(result));
  await prisma.$disconnect();
};
main().catch(async (error) => {
  console.error(error);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
