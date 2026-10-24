import {z} from "zod"
import {getTelemetryView} from "@/lib/telemetry-view"
import {tracedRoute} from "@/lib/observability/server"
export const GET=tracedRoute("GET /api/telemetry/view",async request=>{
 const mode=z.enum(["latest","alerts","readings"]).safeParse(new URL(request.url).searchParams.get("mode")??"latest")
 if(!mode.success)return Response.json({error:"Visão inválida"},{status:400})
 return Response.json(await getTelemetryView(mode.data),{headers:{"Cache-Control":"no-store"}})
})
