import {parse} from "csv-parse/sync"
import {executeCommand,payloadHash,jsonValue,CommandConflict} from "./command-bus"
import {currentTrace} from "@/lib/observability/server"
import {traceHeader} from "@/lib/observability/context"
import {prisma} from "@/lib/prisma"
export async function submitImport(content:string,filename:string,key?:string){
 if(content.length>5*1024*1024)throw new Error("CSV excede 5 MB")
 const rows=parse(content,{columns:true,bom:true,skip_empty_lines:true,trim:true}) as Record<string,string>[]
 if(!rows.length||["id_leitura","id_maquina","data_hora","temp_motor_c","pressao_oleo_psi","rpm","vibracao_mm_s","consumo_l_h","horas_motor"].some(field=>!(field in rows[0])))throw new Error("CSV de telemetria inválido")
 const hash=payloadHash(content)
 return executeCommand({type:"ingestion.submit",idempotencyKey:key??hash,payload:{hash,filename}},async tx=>{
   const trace=currentTrace(),parent=trace?traceHeader(trace):undefined,id=crypto.randomUUID()
   await tx.importJob.create({data:{id,filename:filename.slice(0,180),content,traceparent:parent}})
   await tx.outboxEvent.create({data:{id:crypto.randomUUID(),eventType:"job.submit",aggregateId:id,payload:jsonValue({jobId:id,traceparent:parent})}})
   return {jobId:id,status:"queued"}
 })
}
export async function retryImport(id:string,key:string){
 return executeCommand({type:"ingestion.retry",idempotencyKey:key,payload:{id}},async tx=>{
   const job=await tx.importJob.findUniqueOrThrow({where:{id}})
   if(job.status!=="failed")throw new CommandConflict("Somente importações com falha podem ser reenviadas.")
   await tx.importJob.update({where:{id},data:{status:"queued",attempts:0,progress:0,errorCode:null}})
   await tx.outboxEvent.create({data:{id:crypto.randomUUID(),eventType:"job.submit",aggregateId:id,payload:{jobId:id,traceparent:job.traceparent}}})
   return {jobId:id,status:"queued"}
 })
}
export async function getImportJob(id:string){return prisma.importJob.findUnique({where:{id},select:{id:true,filename:true,status:true,attempts:true,progress:true,result:true,errorCode:true,createdAt:true,updatedAt:true}})}
