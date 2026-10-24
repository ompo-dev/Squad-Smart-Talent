import {prisma} from "@/lib/prisma"
import {importQueue} from "./queue"
import {executeCommand} from "@/lib/application/command-bus"
export async function reconcileImportJobs(){
 const before=new Date(Date.now()-120000)
 const candidates=await prisma.importJob.findMany({where:{status:{in:["queued","running"]},updatedAt:{lt:before}},orderBy:{updatedAt:"asc"},take:100,select:{id:true,updatedAt:true,traceparent:true}})
 for(const job of candidates){
   const pending=await prisma.outboxEvent.count({where:{aggregateId:job.id,eventType:"job.submit",publishedAt:null}});if(pending)continue
   const event=await prisma.outboxEvent.findFirst({where:{aggregateId:job.id,eventType:"job.submit"},orderBy:{createdAt:"desc"}})
   if(event){const existing=await importQueue().getJob(event.id);if(existing&&!["failed","unknown","completed"].includes(await existing.getState()))continue}
   await executeCommand({type:"ingestion.reconcile",idempotencyKey:`${job.id}:${job.updatedAt.getTime()}`,payload:{id:job.id}},async tx=>{
     const claimed=await tx.importJob.updateMany({where:{id:job.id,status:{in:["queued","running"]},updatedAt:job.updatedAt},data:{status:"queued",progress:0,errorCode:null}})
     if(!claimed.count)return {rescued:false}
     await tx.outboxEvent.create({data:{id:crypto.randomUUID(),eventType:"job.submit",aggregateId:job.id,payload:{jobId:job.id,traceparent:job.traceparent}}})
     return {rescued:true}
   })
 }
}
