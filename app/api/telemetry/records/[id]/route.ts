import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {tracedRoute} from "@/lib/observability/server"
import {updateRecord} from "@/lib/application/record-commands"
import {commandResponse,requestCommandKey} from "@/lib/application/http-commands"
type Ctx={params:Promise<{id:string}>}
export const GET=tracedRoute("GET /api/telemetry/records/:id",async(_:Request,context:Ctx)=>{
 const parsed=z.coerce.number().int().positive().max(2147483647).safeParse((await context.params).id)
 if(!parsed.success)return Response.json({error:"ID inválido"},{status:400})
 const row=await prisma.telemetry.findUnique({where:{id:BigInt(parsed.data)}})
 const sensors=row?Object.fromEntries((["temperature","oilPressure","rpm","vibration","consumption","engineHours"] as const).map(field=>[field,row[field]===null||!Number.isFinite(Number(row[field]))?null:Number(row[field])])):{}
 return row?Response.json({...row,...sensors,id:String(row.id)},{headers:{ETag:`"${row.version}"`,"Cache-Control":"no-store"}}):Response.json({error:"Leitura não encontrada"},{status:404})
})
export const PATCH=tracedRoute("PATCH /api/telemetry/records/:id",async(request:Request,context:Ctx)=>{
 const parsed=z.coerce.number().int().positive().max(2147483647).safeParse((await context.params).id)
 if(!parsed.success)return Response.json({error:"ID inválido"},{status:400})
 return commandResponse(async()=>updateRecord(parsed.data,await request.json(),requestCommandKey(request)))
})
