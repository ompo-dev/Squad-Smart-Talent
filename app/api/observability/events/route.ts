import {z} from "zod"
import {persistSpan} from "@/lib/observability/server"
import {safeAttributes} from "@/lib/observability/context"
const event=z.object({traceId:z.string().regex(/^[a-f0-9]{32}$/),spanId:z.string().regex(/^[a-f0-9]{16}$/),parentSpanId:z.string().regex(/^[a-f0-9]{16}$/).optional(),name:z.enum(["component.dispatch","component.storage","component.chat","component.render","zustand.dispatch","zustand.optimistic","zustand.load","zustand.streaming","zustand.commit","zustand.rollback"]),layer:z.enum(["component","zustand"]),status:z.enum(["ok","error"]),durationMs:z.number().min(0).max(3600000),startedAt:z.string().datetime().refine(value=>Math.abs(Date.now()-new Date(value).getTime())<86400000),attributes:z.record(z.string(),z.unknown())})
export async function POST(request:Request){
 const raw=await request.text();if(raw.length>64000)return Response.json({error:"Lote muito grande"},{status:413})
 let body:unknown;try{body=JSON.parse(raw)}catch{return Response.json({error:"JSON inválido"},{status:400})}
 const input=z.object({events:z.array(event).min(1).max(20)}).safeParse(body)
 if(!input.success)return Response.json({error:"Eventos inválidos"},{status:400})
 const operations=["telemetry.apply-change","telemetry.read","conversation.request","chat.analysis"]
 await Promise.all(input.data.events.map(item=>persistSpan({...item,attributes:{operation:operations.includes(String(item.attributes.operation))?String(item.attributes.operation):"client.event",source:"client"}})))
 return Response.json({accepted:input.data.events.length},{status:202})
}
