import {prisma} from "@/lib/prisma"
import {redisConnection} from "@/lib/cache/redis"
import {authReadiness} from "@/lib/auth"
import {z} from "zod"
export const dynamic="force-dynamic"
export async function GET(request:Request){
 const search=new URL(request.url).searchParams,trace=search.get("trace"),status=search.get("status")
 if(trace&&!z.string().regex(/^[a-f0-9]{32}$/).safeParse(trace).success)return Response.json({error:"Trace ID inválido"},{status:400})
 const since=new Date(Date.now()-86400000)
 const where={startedAt:{gte:since},...(trace?{traceId:trace}:{}),...(status==="error"?{status:"error"}:{})}
 const [events,total,errors,commands,replays,latency]=await Promise.all([
   prisma.traceEvent.findMany({where,orderBy:{startedAt:trace?"asc":"desc"},take:trace?300:100}),
   prisma.traceEvent.count({where:{startedAt:{gte:since}}}),prisma.traceEvent.count({where:{startedAt:{gte:since},status:"error"}}),
   prisma.traceEvent.count({where:{startedAt:{gte:since},name:"command.dispatch"}}),
   prisma.traceEvent.count({where:{startedAt:{gte:since},name:"command.dispatch",attributes:{path:["replayed"],equals:true}}}),
   prisma.$queryRaw<{p95:number|null}[]>`SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::float AS p95 FROM trace_events WHERE name='command.dispatch' AND started_at>=${since}`,
 ])
 let redis=false;try{redis=(await(await redisConnection())?.ping())==="PONG"}catch{/* availability is reported, not fabricated */}
 return Response.json({events,stats:{total,errors,commands,replays,p95:latency[0]?.p95??0},services:{redis,auth:authReadiness()}},{headers:{"Cache-Control":"no-store"}})
}
