import {AsyncLocalStorage} from "node:async_hooks"
import {prisma} from "@/lib/prisma"
import {newTraceId,newSpanId,traceIdentity,traceHeader,safeAttributes,type SpanRecord,type Layer} from "./context"
type Context={traceId:string;spanId:string;status:"ok"|"error";attributes:Record<string,unknown>}
const context=new AsyncLocalStorage<Context>()
let sinkUnavailableUntil=0
export function currentTrace(){return context.getStore()}
export function withTraceParent<T>(header:string|null|undefined,run:()=>Promise<T>){const parent=traceIdentity(header);return parent?context.run({...parent,status:"ok",attributes:{}},run):run()}
export async function persistSpan(span:SpanRecord) {
 const record={...span,attributes:safeAttributes(span.attributes)}
 if(process.env.OBSERVABILITY_LOGS!=="off")console.log(JSON.stringify({level:span.status==="error"?"error":"info",event:"trace.span",...record}))
 if(Date.now()<sinkUnavailableUntil)return
 try {await prisma.traceEvent.createMany({data:[{...record,startedAt:new Date(record.startedAt)}],skipDuplicates:true})}
 catch {sinkUnavailableUntil=Date.now()+5000;if(process.env.OBSERVABILITY_LOGS!=="off")console.warn(JSON.stringify({level:"warn",event:"trace.sink_unavailable"}))}
}
export async function withSpan<T>(name:string,layer:Layer,run:(span:Context)=>Promise<T>,attributes:Record<string,unknown>={}):Promise<T> {
 const parent=context.getStore(),startedAt=new Date().toISOString(),start=performance.now()
 const span:Context={traceId:parent?.traceId??newTraceId(),spanId:newSpanId(),status:"ok",attributes:{source:"server",...attributes}}
 return context.run(span,async()=>{try {return await run(span)}catch(error){span.status="error";span.attributes.errorType=error instanceof Error?error.name:"UnknownError";throw error}finally{await persistSpan({traceId:span.traceId,spanId:span.spanId,parentSpanId:parent?.spanId||undefined,name,layer,status:span.status,durationMs:Math.round((performance.now()-start)*1000)/1000,startedAt,attributes:safeAttributes(span.attributes)})}})
}
export async function withRequestTrace(request:Request,name:string,run:()=>Promise<Response>) {
 const incoming=traceIdentity(request.headers.get("traceparent")),root:Context={traceId:incoming?.traceId??newTraceId(),spanId:incoming?.spanId??newSpanId(),status:"ok",attributes:{}}
 const invoke=()=>withSpan(name,"api",async span=>{let response:Response;try{response=await run()}catch(error){span.attributes.errorType=error instanceof Error?error.name:"UnknownError";response=Response.json({error:"Não foi possível concluir esta operação.",traceId:span.traceId},{status:500})}span.attributes.statusCode=response.status;span.status=response.status>=400?"error":"ok";const headers=new Headers(response.headers);headers.set("traceparent",traceHeader(span));headers.set("X-Trace-Id",span.traceId);return new Response(response.body,{status:response.status,statusText:response.statusText,headers})},{method:request.method,route:name})
 return incoming?context.run(root,invoke):context.run({...root,spanId:""},invoke)
}
export function tracedRoute<Args extends unknown[]>(name:string,handler:(request:Request,...args:Args)=>Promise<Response>) {
 return (request:Request,...args:Args)=>withRequestTrace(request,name,()=>handler(request,...args))
}
