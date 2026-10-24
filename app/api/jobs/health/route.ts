import {prisma} from "@/lib/prisma"
import {importQueue} from "@/lib/jobs/queue"
export const dynamic="force-dynamic"
export async function GET(){
 const pending=await prisma.outboxEvent.count({where:{publishedAt:null}})
 try{const counts=await importQueue().getJobCounts("waiting","active","delayed","failed","completed");return Response.json({queue:"available",counts,outboxPending:pending},{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({queue:"unavailable",outboxPending:pending},{status:503})}
}
