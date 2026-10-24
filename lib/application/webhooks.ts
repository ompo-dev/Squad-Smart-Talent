import {createHmac,timingSafeEqual} from "node:crypto"
import {z} from "zod"
import {executeCommand,CommandConflict} from "./command-bus"
const number=(min:number,max:number)=>z.number().finite().min(min).max(max).nullable()
export const webhookInput=z.object({eventId:z.string().regex(/^[a-zA-Z0-9._:-]{8,128}$/),readings:z.array(z.object({id:z.number().int().positive().max(2147483647),machineId:z.number().int().positive().max(100000),timestamp:z.string().datetime(),temperature:number(-100,1000),oilPressure:number(0,500),rpm:number(0,10000),vibration:number(0,100),consumption:number(0,1000),engineHours:number(0,1000000),expectedVersion:z.number().int().min(0).optional()}).strict()).min(1).max(500)}).strict()
export function validWebhookSignature(raw:string|Uint8Array,timestamp:string|null,signature:string|null,secret:string,now=Date.now()){
 if(!timestamp||!/^\d{10}$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000||!signature||!/^sha256=[a-f0-9]{64}$/i.test(signature))return false
 const expected=createHmac("sha256",secret).update(`${timestamp}.`).update(raw).digest(),received=Buffer.from(signature.slice(7),"hex")
 return received.length===expected.length&&timingSafeEqual(received,expected)
}
export async function receiveTelemetryWebhook(body:unknown){
 const input=webhookInput.parse(body)
 if(new Set(input.readings.map(row=>row.id)).size!==input.readings.length)throw new Error("IDs duplicados no lote")
 return executeCommand({type:"telemetry.webhook",idempotencyKey:input.eventId,payload:input},async tx=>{
   const existing=await tx.telemetry.findMany({where:{id:{in:input.readings.map(row=>BigInt(row.id))}},select:{id:true,version:true}}),versions=new Map(existing.map(row=>[String(row.id),row.version]))
   let created=0,updated=0;const results:{id:number;version:number}[]=[]
   for(const row of [...input.readings].sort((a,b)=>a.id-b.id)){
     const {id,expectedVersion,timestamp,...sensors}=row,data={...sensors,timestamp:new Date(timestamp)}
     if(versions.has(String(id))){
       if(expectedVersion===undefined)throw new CommandConflict("Registros existentes exigem expectedVersion para atualizar.")
       const result=await tx.telemetry.updateMany({where:{id:BigInt(id),version:expectedVersion},data:{...data,version:{increment:1}}})
       if(!result.count)throw new CommandConflict("O registro foi atualizado por outra pessoa. Consulte a nova versão.")
       updated++;results.push({id,version:expectedVersion+1})
     }else{
       if(expectedVersion!==undefined&&expectedVersion!==0)throw new CommandConflict("Versão inicial inválida")
       await tx.telemetry.create({data:{id:BigInt(id),...data}});created++;results.push({id,version:0})
     }
   }
   return {eventId:input.eventId,accepted:input.readings.length,created,updated,versions:results}
 })
}
