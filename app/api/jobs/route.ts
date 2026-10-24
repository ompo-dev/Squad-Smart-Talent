import {prisma} from "@/lib/prisma"
import {tracedRoute} from "@/lib/observability/server"
export const GET=tracedRoute("GET /api/jobs",async()=>Response.json(await prisma.importJob.findMany({orderBy:{createdAt:"desc"},take:100,select:{id:true,filename:true,status:true,attempts:true,progress:true,errorCode:true,createdAt:true,updatedAt:true}}),{headers:{"Cache-Control":"no-store"}}))
