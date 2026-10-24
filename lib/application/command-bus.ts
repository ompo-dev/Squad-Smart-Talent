import {createHash,randomUUID} from "node:crypto"
import {prisma} from "@/lib/prisma"
import type {Prisma} from "@/generated/prisma/client"
import {withSpan} from "@/lib/observability/server"
import {invalidateTelemetryCache} from "@/lib/cache/telemetry-cache"
import {currentTrace} from "@/lib/observability/server"
import {traceHeader} from "@/lib/observability/context"
export type Command<T>={type:string;payload:T;idempotencyKey?:string}
export class CommandConflict extends Error {}
function canonical(value:unknown):unknown {return Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):typeof value==="bigint"?String(value):value}
export function payloadHash(value:unknown) {return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}
export function jsonValue(value:unknown) {return JSON.parse(JSON.stringify(value,(_,item)=>typeof item==="bigint"?String(item):item)) as Prisma.InputJsonValue}
export async function executeCommand<T,R>(command:Command<T>,handler:(tx:Prisma.TransactionClient,payload:T)=>Promise<R>):Promise<R> {
  const id=`${command.type}:${command.idempotencyKey??randomUUID()}`,hash=payloadHash(command.payload)
  return withSpan("command.dispatch","command",async span=>{
  let replayed=false,revision:string|undefined
  const result=await withSpan("command.transaction","postgres",()=>prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`
    const receipt=await tx.commandReceipt.findUnique({where:{id}})
    if(receipt){if(receipt.payloadHash!==hash)throw new CommandConflict("Chave de idempotência já usada com outros dados");replayed=true;return receipt.result as R}
    const result=await handler(tx,command.payload)
    await tx.commandReceipt.create({data:{id,type:command.type,payloadHash:hash,result:jsonValue(result)}})
    if(["telemetry.apply-change","telemetry.import-csv","telemetry.update-record","telemetry.webhook"].includes(command.type)){
      revision=String((await tx.cacheRevision.upsert({where:{key:"telemetry"},create:{key:"telemetry",value:BigInt(1)},update:{value:{increment:1}}})).value)
      const trace=currentTrace(),record=result as {readingId?:number;version?:number}
      await tx.outboxEvent.create({data:{id:randomUUID(),eventType:"telemetry.changed",aggregateId:String(record.readingId??"telemetry"),payload:jsonValue({revision,readingId:record.readingId,version:record.version,traceparent:trace?traceHeader(trace):undefined})}})
    }
    return result
  },{timeout:30000,maxWait:10000}),{operation:command.type})
  span.attributes.replayed=replayed;span.attributes.outcome=replayed?"replayed":"committed"
  if(revision)await invalidateTelemetryCache(revision)
  return result
  },{operation:command.type})
}
