import {prisma} from "@/lib/prisma"
import {redisConnection} from "@/lib/cache/redis"
export const dynamic="force-dynamic"
export async function GET(){try{await prisma.$queryRaw`SELECT 1`;const redis=await redisConnection();return Response.json({status:redis?.isReady?"ok":"degraded",database:true,redis:!!redis?.isReady},{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({status:"unavailable"},{status:503})}}
