import {prisma} from "@/lib/prisma"
export const dynamic="force-dynamic"
export async function GET(){
 const rows=await prisma.$queryRaw<{name:string;layer:string;status:string;outcome:string|null;count:number;seconds:number}[]>`SELECT name,layer,status,attributes->>'outcome' AS outcome,COUNT(*)::float AS count,SUM(duration_ms)/1000 AS seconds FROM trace_events GROUP BY 1,2,3,4 ORDER BY 1,2,3,4`
 const esc=(value:string)=>value.replaceAll("\\","\\\\").replaceAll('"','\\"').replaceAll("\n","\\n")
 const labels=(row:typeof rows[number])=>`operation="${esc(row.name)}",layer="${esc(row.layer)}",status="${row.status}",outcome="${esc(row.outcome??"none")}"`
 const lines=["# HELP telemetry_spans_total Recorded spans by operation, layer, status and cache outcome.","# TYPE telemetry_spans_total counter",...rows.map(row=>`telemetry_spans_total{${labels(row)}} ${row.count}`),"# HELP telemetry_span_duration_seconds Recorded span duration.","# TYPE telemetry_span_duration_seconds summary",...rows.flatMap(row=>[`telemetry_span_duration_seconds_sum{${labels(row)}} ${row.seconds}`,`telemetry_span_duration_seconds_count{${labels(row)}} ${row.count}`])]
 const [jobs,pending]=await Promise.all([prisma.importJob.groupBy({by:["status"],_count:{_all:true}}),prisma.outboxEvent.count({where:{publishedAt:null}})])
 lines.push("# HELP telemetry_import_jobs Import jobs by durable database state.","# TYPE telemetry_import_jobs gauge",...jobs.map(job=>`telemetry_import_jobs{status="${esc(job.status)}"} ${job._count._all}`),"# HELP telemetry_outbox_pending Events awaiting publication.","# TYPE telemetry_outbox_pending gauge",`telemetry_outbox_pending ${pending}`)
 return new Response(lines.join("\n")+"\n",{headers:{"Content-Type":"text/plain; version=0.0.4; charset=utf-8","Cache-Control":"no-store"}})
}
