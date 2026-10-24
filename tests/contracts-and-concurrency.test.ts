import {test,after} from "node:test"
import assert from "node:assert/strict"
import {createHmac} from "node:crypto"
import {readdirSync,readFileSync} from "node:fs"
import SwaggerParser from "@apidevtools/swagger-parser"
import {openapi} from "../lib/openapi"
import {prisma} from "../lib/prisma"
import {updateRecord} from "../lib/application/record-commands"
import {receiveTelemetryWebhook,validWebhookSignature} from "../lib/application/webhooks"
import {CommandConflict} from "../lib/application/command-bus"
import {proposeChange,applyChange} from "../lib/telemetry-edits"
import {boundedBody,BodyTooLarge} from "../lib/application/http-body"
import {submitImport,retryImport} from "../lib/application/import-jobs"
import {closeRedis} from "../lib/cache/redis"
import {useTelemetryStore} from "../lib/stores/telemetry-store"
import axios from "axios"
process.env.OBSERVABILITY_LOGS="off"
after(async()=>{await closeRedis();await prisma.$disconnect()})
const reading=(id:number)=>({id,machineId:100000,timestamp:"2026-05-01T00:00:00.000Z",temperature:70,oilPressure:40,rpm:1000,vibration:2,consumption:10,engineHours:100})
const base=()=>1700000000+Math.floor(Math.random()*1000000)

test("OpenAPI válido documenta todos os métodos e rotas da aplicação",async()=>{
 await SwaggerParser.validate(structuredClone(openapi) as never)
 const paths=openapi.paths as Record<string,Record<string,unknown>>,operations:string[]=[]
 for(const file of readdirSync("app/api",{recursive:true,encoding:"utf8"}).filter(file=>file.endsWith("route.ts"))){
   const normalized=file.replaceAll("\\","/"),path="/api/"+normalized.replace(/\/route\.ts$/,"").replace(/\[\.\.\.all\]/g,"{action}").replace(/\[(\w+)\]/g,"{$1}")
   const source=readFileSync(`app/api/${file}`,"utf8")
   for(const match of source.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PATCH|PUT|DELETE)\b/g))assert.ok(paths[path]?.[match[1].toLowerCase()],`${match[1]} ${path} ausente do Swagger`)
 }
 for(const path of Object.values(paths))for(const value of Object.values(path)){const operation=value as {operationId?:string};if(operation.operationId)operations.push(operation.operationId)}
 assert.equal(new Set(operations).size,operations.length)
})

test("dois editores na mesma versão: um commit, um conflito e proposta antiga rejeitada",async()=>{
 const id=base(),keys=[crypto.randomUUID(),crypto.randomUUID()],payloads=[{expectedVersion:0,field:"pressao_oleo_psi",value:42,reason:"Teste concorrente A"},{expectedVersion:0,field:"rpm",value:1100,reason:"Teste concorrente B"}]
 await prisma.telemetry.create({data:{...reading(id),id:BigInt(id),timestamp:new Date(reading(id).timestamp)}})
 try{
   const proposal=await proposeChange({reading_id:id,field:"temp_motor_c",value:71,reason:"Prévia anterior ao outro editor"})
   const results=await Promise.allSettled(payloads.map((payload,index)=>updateRecord(id,payload,keys[index])))
   assert.equal(results.filter(result=>result.status==="fulfilled").length,1)
   const failure=results.find(result=>result.status==="rejected");assert.ok(failure?.status==="rejected"&&failure.reason instanceof CommandConflict)
   const winner=results.findIndex(result=>result.status==="fulfilled"),row=await prisma.telemetry.findUniqueOrThrow({where:{id:BigInt(id)}})
   assert.equal(row.version,1);assert.equal(Number(row.temperature),70)
   await assert.rejects(applyChange(proposal.change.id),/mudou após a prévia/)
   assert.equal(await prisma.telemetryChange.count({where:{readingId:id,status:"applied"}}),1)
   const repeated=await updateRecord(id,payloads[winner],keys[winner]);assert.equal(repeated.version,1)
   assert.equal((await prisma.telemetry.findUniqueOrThrow({where:{id:BigInt(id)}})).version,1)
 }finally{await prisma.telemetryChange.deleteMany({where:{readingId:id}});await prisma.telemetry.deleteMany({where:{id:BigInt(id)}})}
})

test("webhook repete sem duplicar e conflito desfaz todo o lote",async()=>{
 const id=base(),eventId=crypto.randomUUID(),initial={eventId,readings:[reading(id+1),reading(id+2)]}
 try{
   const first=await receiveTelemetryWebhook(initial);assert.equal(first.created,2);assert.deepEqual(await receiveTelemetryWebhook(initial),first)
   await assert.rejects(receiveTelemetryWebhook({...initial,readings:[reading(id+1)]}),CommandConflict)
   await updateRecord(id+2,{expectedVersion:0,field:"temp_motor_c",value:72,reason:"Outro editor atualizou"},crypto.randomUUID())
   const batch={eventId:crypto.randomUUID(),readings:[reading(id),{...reading(id+1),temperature:88,expectedVersion:0},{...reading(id+2),temperature:90,expectedVersion:0}]}
   await assert.rejects(receiveTelemetryWebhook(batch),CommandConflict)
   assert.equal(await prisma.telemetry.count({where:{id:BigInt(id)}}),0)
   const unchanged=await prisma.telemetry.findUniqueOrThrow({where:{id:BigInt(id+1)}});assert.equal(unchanged.version,0);assert.equal(Number(unchanged.temperature),70)
   const applied=await receiveTelemetryWebhook({eventId:crypto.randomUUID(),readings:[{...reading(id+2),temperature:73,expectedVersion:1}]});assert.equal(applied.updated,1);assert.equal(applied.versions[0].version,2)
 }finally{await prisma.telemetryChange.deleteMany({where:{readingId:{in:[id,id+1,id+2]}}});await prisma.telemetry.deleteMany({where:{id:{in:[BigInt(id),BigInt(id+1),BigInt(id+2)]}}})}
})

test("HMAC verifica bytes UTF-8, alteração de corpo e expiração; limite cancela leitura",async()=>{
 const raw=Buffer.from('{"texto":"telemetria ç"}'),timestamp=String(Math.floor(Date.now()/1000)),secret="test-secret-for-hmac-at-least-32-characters",signature="sha256="+createHmac("sha256",secret).update(timestamp+".").update(raw).digest("hex")
 assert.equal(validWebhookSignature(raw,timestamp,signature,secret),true)
 assert.equal(validWebhookSignature(Buffer.concat([raw,Buffer.from(" ")]),timestamp,signature,secret),false)
 assert.equal(validWebhookSignature(raw,timestamp,signature,secret,Date.now()+301000),false)
 assert.equal(validWebhookSignature(raw,timestamp,"sha256=bad",secret),false)
 let cancelled=false
 const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(5));controller.enqueue(new Uint8Array(7))},cancel(){cancelled=true}})
 const request=new Request("http://localhost/test",Object.assign({method:"POST",body:stream},{duplex:"half"}))
 await assert.rejects(boundedBody(request,10),BodyTooLarge);assert.equal(cancelled,true)
})

test("job e outbox são atômicos; replay não cria outro job e retry exige falha",async()=>{
 const key=crypto.randomUUID(),csv="id_leitura,id_maquina,data_hora,temp_motor_c,pressao_oleo_psi,rpm,vibracao_mm_s,consumo_l_h,horas_motor\n1,1,2026-05-01 00:00:00,70,40,1000,2,10,100"
 const result=await submitImport(csv,"test-contract.csv",key)
 try{
   assert.deepEqual(await submitImport(csv,"test-contract.csv",key),result)
   assert.equal(await prisma.outboxEvent.count({where:{eventType:"job.submit",aggregateId:result.jobId}}),1)
   await assert.rejects(retryImport(result.jobId,crypto.randomUUID()),CommandConflict)
   await prisma.importJob.update({where:{id:result.jobId},data:{status:"failed",errorCode:"IMPORT_FAILED"}})
   const retryKey=crypto.randomUUID();await retryImport(result.jobId,retryKey);await retryImport(result.jobId,retryKey)
   assert.equal(await prisma.outboxEvent.count({where:{eventType:"job.submit",aggregateId:result.jobId}}),2)
 }finally{await prisma.outboxEvent.deleteMany({where:{aggregateId:result.jobId}});await prisma.importJob.deleteMany({where:{id:result.jobId}})}
})

test("Zustand descarta uma resposta antiga após invalidação por evento remoto",async()=>{
 const previous=axios.get;let release!:(result:unknown)=>void
 axios.get=(()=>new Promise<unknown>(resolve=>{release=resolve})) as typeof axios.get
 try{
   useTelemetryStore.getState().invalidate();const pending=useTelemetryStore.getState().load("latest")
   useTelemetryStore.getState().invalidate();release({data:{rows:[{id:1}]},headers:{}});await pending
   assert.equal(useTelemetryStore.getState().views.latest,undefined);assert.equal(useTelemetryStore.getState().loading.latest,undefined)
 }finally{axios.get=previous;useTelemetryStore.getState().invalidate()}
})
