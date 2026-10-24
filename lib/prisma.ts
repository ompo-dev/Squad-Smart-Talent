import {PrismaClient} from "@/generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"
const shared=globalThis as unknown as {telemetryPrisma?:PrismaClient}
export const prisma=shared.telemetryPrisma??new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL,max:6,connectionTimeoutMillis:5000,idleTimeoutMillis:1000})})
if(process.env.NODE_ENV!=="production")shared.telemetryPrisma=prisma
