import {prisma} from "@/lib/prisma"
import {importQueue} from "./queue"
import {redisConnection} from "@/lib/cache/redis"
import {withSpan,withTraceParent,currentTrace} from "@/lib/observability/server"
import {traceHeader} from "@/lib/observability/context"
const owner=crypto.randomUUID()
export async function publishOutboxBatch(){
 const events=await prisma.$queryRaw<{id:string;event_type:string;aggregate_id:string;payload:Record<string,unknown>;created_at:Date}[]>`UPDATE outbox_events SET locked_at=now(),locked_by=${owner} WHERE id IN (SELECT id FROM outbox_events WHERE published_at IS NULL AND next_attempt_at<=now() AND (locked_at IS NULL OR locked_at<now()-INTERVAL '60 seconds') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20) RETURNING id,event_type,aggregate_id,payload,created_at`
 for(const event of events)await withTraceParent(typeof event.payload.traceparent==="string"?event.payload.traceparent:undefined,async()=>{
   try{
     await withSpan("outbox.publish","worker",async()=>{
       if(event.event_type==="job.submit")await importQueue().add("telemetry.import",{jobId:event.aggregate_id},{jobId:event.id})
       const redis=await redisConnection();if(!redis)throw new Error("Redis unavailable")
       const {traceparent:_,...payload}=event.payload
       await withSpan("realtime.publish","redis",async()=>{const trace=currentTrace();await redis.publish("telemetry:events",JSON.stringify({id:event.id,type:event.event_type,aggregateId:event.aggregate_id,at:event.created_at.toISOString(),payload,traceparent:trace?traceHeader(trace):undefined}))},{operation:event.event_type})
       await prisma.outboxEvent.updateMany({where:{id:event.id,lockedBy:owner},data:{publishedAt:new Date(),lockedAt:null,lockedBy:null}})
     },{operation:event.event_type})
   }catch{await prisma.outboxEvent.updateMany({where:{id:event.id,lockedBy:owner},data:{attempts:{increment:1},nextAttemptAt:new Date(Date.now()+5000),lockedAt:null,lockedBy:null}})}
 })
 return events.length
}
