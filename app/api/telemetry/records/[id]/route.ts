import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {tracedRoute} from "@/lib/observability/server"
import {updateRecord} from "@/lib/application/record-commands"
import {commandResponse,requestCommandKey} from "@/lib/application/http-commands"
import {sensorDefinitions} from "@/lib/telemetry-schema"

type Ctx={params:Promise<{id:string}>}

export const GET=tracedRoute("GET /api/telemetry/records/:id",async(_:Request,context:Ctx)=>{
 const parsed=z.coerce.number().int().positive().max(2147483647).safeParse((await context.params).id)
 if(!parsed.success)return Response.json({error:"ID inválido"},{status:400})
 const row=await prisma.telemetry.findUnique({where:{id:BigInt(parsed.data)}})
 if(!row)return Response.json({error:"Leitura não encontrada"},{status:404})
 const sensors=Object.fromEntries(sensorDefinitions.map(definition=>[definition.column,row[definition.key]===null?null:Number(row[definition.key])]))
 return Response.json({
  id:String(row.id),record_key:row.recordKey,version:row.version,machine_id:row.machineId,assembly_line:row.assemblyLine,
  date:row.timestamp.toISOString(),...sensors,downtime:row.downtime,downtime_label:row.downtimeLabel,quality_issues:row.qualityIssues,
 },{headers:{ETag:`"${row.version}"`,"Cache-Control":"no-store"}})
})

export const PATCH=tracedRoute("PATCH /api/telemetry/records/:id",async(request:Request,context:Ctx)=>{
 const parsed=z.coerce.number().int().positive().max(2147483647).safeParse((await context.params).id)
 if(!parsed.success)return Response.json({error:"ID inválido"},{status:400})
 return commandResponse(async()=>updateRecord(parsed.data,await request.json(),requestCommandKey(request)))
})
