import {Worker,UnrecoverableError} from "bullmq"
import {createServer} from "node:http"
import {prisma} from "../lib/prisma"
import {queueConnection,closeImportQueue} from "../lib/jobs/queue"
import {publishOutboxBatch} from "../lib/jobs/outbox"
import {reconcileImportJobs} from "../lib/jobs/reconcile"
import {redisConnection,closeRedis} from "../lib/cache/redis"
import {importTelemetry} from "../lib/application/import-telemetry"
import {withSpan,withTraceParent,currentTrace} from "../lib/observability/server"
import {traceHeader} from "../lib/observability/context"
import {jsonValue} from "../lib/application/command-bus"
let stopping=false,pumping=false
let reconciling=false
const worker=new Worker<{jobId:string}>("telemetry-imports",async job=>{
 const record=await prisma.importJob.findUniqueOrThrow({where:{id:job.data.jobId}})
 if(record.status==="completed")return record.result
 return withTraceParent(record.traceparent,()=>withSpan("job.import","worker",async()=>{
   await prisma.importJob.updateMany({where:{id:record.id,status:{not:"completed"}},data:{status:"running",attempts:{increment:record.attempts<5?1:0},progress:10,errorCode:null}})
   try{
     if(record.attempts>=5&&!await prisma.commandReceipt.findUnique({where:{id:`telemetry.import-csv:job-${record.id}`}}))throw new UnrecoverableError("Tentativas esgotadas")
     const result=await importTelemetry(record.content,`job-${record.id}`)
     await prisma.$transaction(async tx=>{
       const updated=await tx.importJob.updateMany({where:{id:record.id,status:{not:"completed"}},data:{status:"completed",progress:100,result:jsonValue(result)}})
       const trace=currentTrace();if(updated.count)await tx.outboxEvent.create({data:{id:crypto.randomUUID(),eventType:"job.completed",aggregateId:record.id,payload:jsonValue({jobId:record.id,status:"completed",traceparent:trace?traceHeader(trace):undefined})}})
     })
     await job.updateProgress(100);return result
   }catch(error){
     const invalid=error instanceof Error&&(error.name==="CsvError"||/^(CSV|O CSV|Nenhuma leitura válida)/.test(error.message))
     const final=invalid||error instanceof UnrecoverableError||record.attempts+1>=5||job.attemptsMade+1>=(job.opts.attempts??1)
     await prisma.$transaction(async tx=>{
       const updated=await tx.importJob.updateMany({where:{id:record.id,status:{not:"completed"}},data:{status:final?"failed":"queued",errorCode:invalid?"INVALID_CSV":"IMPORT_FAILED"}})
       const trace=currentTrace();if(final&&updated.count)await tx.outboxEvent.create({data:{id:crypto.randomUUID(),eventType:"job.failed",aggregateId:record.id,payload:jsonValue({jobId:record.id,status:"failed",traceparent:trace?traceHeader(trace):undefined})}})
     })
     if(invalid)throw new UnrecoverableError("CSV inválido")
     if(final)throw new UnrecoverableError("Importação não concluída após as tentativas")
     throw new Error("Importação não concluída")
   }
 },{operation:"telemetry.import"}))
},{connection:queueConnection(true),concurrency:2,lockDuration:60000})
worker.on("error",()=>console.warn(JSON.stringify({level:"warn",event:"worker.connection_error"})))
worker.on("failed",()=>{})
const timer=setInterval(async()=>{if(stopping||pumping)return;pumping=true;try{await publishOutboxBatch()}catch{console.warn(JSON.stringify({level:"warn",event:"outbox.retry"}))}finally{pumping=false}},1000)
const recovery=setInterval(async()=>{if(stopping||reconciling)return;reconciling=true;try{await reconcileImportJobs()}catch{console.warn(JSON.stringify({level:"warn",event:"queue.reconcile_retry"}))}finally{reconciling=false}},30000)
const health=createServer(async(request,response)=>{if(request.url!=="/health"){response.writeHead(404).end();return}try{const redis=await redisConnection(),running=worker.isRunning()&&!!redis?.isReady;response.writeHead(running?200:503,{"Content-Type":"application/json"}).end(JSON.stringify({status:running?"ok":"starting"}))}catch{response.writeHead(503).end()}}).listen(3003,"0.0.0.0")
async function stop(){if(stopping)return;stopping=true;clearInterval(timer);clearInterval(recovery);health.close();await worker.close();while(pumping||reconciling)await new Promise(resolve=>setTimeout(resolve,50));await closeImportQueue();await closeRedis();await prisma.$disconnect();process.exit(0)}
process.on("SIGTERM",()=>void stop());process.on("SIGINT",()=>void stop())
console.log(JSON.stringify({level:"info",event:"worker.ready"}))
