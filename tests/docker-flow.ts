import assert from "node:assert/strict"
import {createHmac} from "node:crypto"
import {existsSync} from "node:fs"
import {WebSocket} from "ws"
import SwaggerParser from "@apidevtools/swagger-parser"
import {prisma} from "../lib/prisma"
import {importQueue,closeImportQueue} from "../lib/jobs/queue"
import {invalidateTelemetryCache} from "../lib/cache/telemetry-cache"
import {closeRedis} from "../lib/cache/redis"
if(existsSync(".env"))process.loadEnvFile(".env")
const base=process.env.TEST_API_URL??"http://localhost:3000",secret=process.env.WEBHOOK_SECRET
assert.ok(secret&&secret.length>=32,"Configure WEBHOOK_SECRET para testar a integração local")
const fixture=1800000000+Math.floor(Math.random()*1000000),machineId=`Docker-Webhook-${fixture}`,importMachine=`Docker-Import-${fixture}`,jobs=new Set<string>(),receipts=new Set<string>()
type Event={id?:string;type:string;aggregateId?:string;traceparent?:string;payload?:Record<string,unknown>}
const clients:{socket:WebSocket;events:Event[]}[]=[]
const reading=(index=0)=>({date:new Date(Date.UTC(2026,4,2,index)).toISOString(),machine_id:machineId,assembly_line:"Shopfloor-L1",hydraulic_pressure_bar:140,coolant_temperature_c:30,spindle_speed_rpm:1000,spindle_vibration_um:2,torque_nm:10,cutting_kn:2,downtime:false,downtime_label:"No_Machine_Failure"})
async function waitFor(check:()=>Promise<boolean>|boolean,timeout=20000){const until=Date.now()+timeout;while(Date.now()<until){if(await check())return;await new Promise(resolve=>setTimeout(resolve,150))}throw new Error("Tempo esgotado ao aguardar integração")}
async function signed(input:unknown){const raw=JSON.stringify(input),timestamp=String(Math.floor(Date.now()/1000)),signature="sha256="+createHmac("sha256",secret!).update(timestamp+".").update(raw).digest("hex");return fetch(base+"/api/webhooks/telemetry",{method:"POST",headers:{"Content-Type":"application/json","X-Webhook-Timestamp":timestamp,"X-Webhook-Signature":signature},body:raw})}
async function submit(csv:string,key:string,parent?:string){const form=new FormData();form.set("file",new File([csv],"docker-integration.csv"));const response=await fetch(base+"/api/import?async=true",{method:"POST",headers:{"Idempotency-Key":key,...(parent?{traceparent:parent}:{})},body:form});assert.equal(response.status,202);const result=await response.json();jobs.add(result.jobId);receipts.add(`ingestion.submit:${key}`);receipts.add(`telemetry.import-csv:job-${result.jobId}`);return result.jobId as string}
async function jobState(id:string){const response=await fetch(`${base}/api/jobs/${id}`);assert.equal(response.status,200);return response.json()}
try{
 const docs=await fetch(base+"/docs");assert.equal(docs.status,200);assert.match(await docs.text(),/SwaggerUIBundle/)
 for(const asset of ["swagger-ui.css","swagger-ui-bundle.js"])assert.equal((await fetch(base+"/swagger/"+asset)).status,200)
 await SwaggerParser.validate(await(await fetch(base+"/api/openapi")).json())
 assert.equal((await fetch(base+"/api/health")).status,200)
 const config=await(await fetch(base+"/api/realtime/config")).json()
 for(let index=0;index<2;index++){
   const socket=new WebSocket(config.url,"telemetry.events.v1",{origin:new URL(base).origin}),events:Event[]=[];clients.push({socket,events});socket.on("message",raw=>events.push(JSON.parse(String(raw))))
   await new Promise<void>((resolve,reject)=>{socket.once("open",resolve);socket.once("error",reject)})
 }
 const eventId=crypto.randomUUID(),batch={eventId,readings:[reading(0),reading(1)]};receipts.add(`telemetry.webhook:${eventId}`)
 const created=await signed(batch);assert.equal(created.status,200);const createdBody=await created.json();assert.equal(createdBody.created,2)
 const replay=await signed(batch);assert.equal(replay.status,200);assert.equal((await replay.json()).created,2)
 const recordRow=await prisma.telemetry.findUniqueOrThrow({where:{recordKey:createdBody.versions[0].recordKey}})
 const record=await(await fetch(`${base}/api/telemetry/records/${recordRow.id}`)).json();assert.equal(record.version,0);assert.equal(record.id,String(recordRow.id));assert.equal(record.machine_id,machineId)
 const keys=[crypto.randomUUID(),crypto.randomUUID()],payloads=[{expectedVersion:0,field:"hydraulic_pressure_bar",value:142,reason:"Integração editor A"},{expectedVersion:0,field:"spindle_speed_rpm",value:1300,reason:"Integração editor B"}]
 const changes=await Promise.all(payloads.map((payload,index)=>{receipts.add(`telemetry.update-record:${keys[index]}`);return fetch(`${base}/api/telemetry/records/${recordRow.id}`,{method:"PATCH",headers:{"Content-Type":"application/json","Idempotency-Key":keys[index]},body:JSON.stringify(payload)})}))
 assert.deepEqual(changes.map(response=>response.status).sort(),[200,409])
 const winner=changes.findIndex(response=>response.ok),repeat=await fetch(`${base}/api/telemetry/records/${recordRow.id}`,{method:"PATCH",headers:{"Content-Type":"application/json","Idempotency-Key":keys[winner]},body:JSON.stringify(payloads[winner])});assert.equal(repeat.status,200);assert.equal((await repeat.json()).version,1)
 const updatedRecord=await prisma.telemetry.findFirstOrThrow({where:{machineId,version:1}})
 const conflict=await signed({eventId:crypto.randomUUID(),readings:[{...reading(0),record_key:updatedRecord.recordKey,coolant_temperature_c:99,expectedVersion:0}]});assert.equal(conflict.status,409)
 const invalid=await fetch(base+"/api/webhooks/telemetry",{method:"POST",headers:{"X-Webhook-Timestamp":String(Math.floor(Date.now()/1000)),"X-Webhook-Signature":"sha256="+"0".repeat(64)},body:JSON.stringify(batch)});assert.equal(invalid.status,401)
 const csvHeader="date,machine_id,assembly_line,coolant_temperature_c,spindle_speed_rpm,downtime\n",csv=csvHeader+`2026-05-02,${importMachine},Shopfloor-L1,28.4,1100,No_Machine_Failure`,key=crypto.randomUUID(),traceId=crypto.randomUUID().replaceAll("-",""),parent=`00-${traceId}-1111111111111111-01`
 const submitted=await Promise.all([submit(csv,key,parent),submit(csv,key,parent)]);assert.equal(submitted[0],submitted[1]);const job=submitted[0]
 await waitFor(async()=>{const data=await jobState(job);if(data.status==="failed")throw new Error(data.errorCode);return data.status==="completed"})
 assert.equal((await jobState(job)).result.inserted,1)
 await waitFor(()=>clients.every(client=>client.events.some(event=>event.type==="job.completed"&&event.aggregateId===job)&&client.events.some(event=>event.type==="telemetry.changed")))
 for(const client of clients){const event=client.events.find(event=>event.type==="job.completed"&&event.aggregateId===job)!;assert.match(event.traceparent!,/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);assert.ok(!JSON.stringify(event).includes("coolant"))}
 await waitFor(async()=>{const data=await(await fetch(`${base}/api/observability?trace=${traceId}`)).json();return ["api","command","postgres","redis","worker","websocket"].every(layer=>data.events.some((event:{layer:string})=>event.layer===layer))})
 const bad=await submit(csvHeader+`invalid-date,${importMachine},Shopfloor-L1,28.4,1100,No_Machine_Failure`,crypto.randomUUID());await waitFor(async()=>(await jobState(bad)).status==="failed");assert.equal((await jobState(bad)).errorCode,"INVALID_CSV");assert.equal((await jobState(bad)).attempts,1)
 const retryKey=crypto.randomUUID();receipts.add(`ingestion.retry:${retryKey}`);const retried=await fetch(`${base}/api/jobs/${bad}/retry`,{method:"POST",headers:{"Idempotency-Key":retryKey}});assert.equal(retried.status,200);await waitFor(async()=>(await jobState(bad)).status==="failed")
 assert.equal((await fetch(base+"/api/jobs/health")).status,200)
 const metrics=await(await fetch(base+"/api/metrics")).text();assert.match(metrics,/telemetry_import_jobs/);assert.match(metrics,/telemetry_outbox_pending/)
 console.log(JSON.stringify({swagger:true,signedWebhook:true,idempotency:true,concurrentUpdates:[200,409],queuedImport:true,workerFailureAndRetry:true,websocketClients:clients.length,distributedTrace:true}))
}finally{
 for(const client of clients)client.socket.close()
 const events=await prisma.outboxEvent.findMany({where:{aggregateId:{in:[...jobs]}},select:{id:true}})
 for(const event of events)try{const job=await importQueue().getJob(event.id);if(job)await job.remove()}catch{/* completed/failed bookkeeping may still be finishing */}
 const readings=await prisma.telemetry.findMany({where:{machineId:{in:[machineId,importMachine]}},select:{id:true}})
 const revision=await prisma.$transaction(async tx=>{
   await tx.telemetryChange.deleteMany({where:{readingId:{in:readings.map(row=>row.id)}}});await tx.telemetry.deleteMany({where:{machineId:{in:[machineId,importMachine]}}})
   await tx.outboxEvent.deleteMany({where:{aggregateId:{in:[...jobs,...readings.map(row=>String(row.id))]}}});await tx.importJob.deleteMany({where:{id:{in:[...jobs]}}});await tx.commandReceipt.deleteMany({where:{id:{in:[...receipts]}}})
   const revision=await tx.cacheRevision.upsert({where:{key:"telemetry"},create:{key:"telemetry",value:BigInt(1)},update:{value:{increment:1}}});await tx.outboxEvent.create({data:{id:crypto.randomUUID(),eventType:"telemetry.changed",aggregateId:"telemetry",payload:{revision:String(revision.value)}}});return String(revision.value)
 });await invalidateTelemetryCache(revision);await closeImportQueue();await closeRedis();await prisma.$disconnect()
}
