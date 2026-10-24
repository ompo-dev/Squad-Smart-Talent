"use client"
import {newTraceId,newSpanId,traceIdentity,traceHeader,type SpanRecord} from "./context"
export function startClientFlow(operation:string,entry="component.dispatch") {
 const traceId=newTraceId(),rootId=newSpanId(),start=performance.now(),events:SpanRecord[]=[]
 let parentSpanId=rootId
 const root:SpanRecord={traceId,spanId:rootId,name:entry,layer:"component",status:"ok",durationMs:0,startedAt:new Date().toISOString(),attributes:{operation,source:"client"}}
 events.push(root)
 return {
   header:()=>traceHeader({traceId,spanId:parentSpanId}),
   serverParent:(header:unknown)=>{const parsed=typeof header==="string"?traceIdentity(header):undefined;if(parsed?.traceId===traceId)parentSpanId=parsed.spanId},
   mark:(name:string,status:"ok"|"error"="ok")=>{const spanId=newSpanId();events.push({traceId,spanId,parentSpanId,name,layer:name.startsWith("zustand")?"zustand":"component",status,durationMs:0,startedAt:new Date().toISOString(),attributes:{operation,source:"client"}});parentSpanId=spanId;return traceHeader({traceId,spanId})},
   flush:(status:"ok"|"error"="ok")=>{root.durationMs=Math.round((performance.now()-start)*1000)/1000;root.status=status;void fetch("/api/observability/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({events}),keepalive:true}).catch(()=>{})},
 }
}
export function recordComponentRender(parent:string,operation:string) {
 const parsed=traceIdentity(parent);if(!parsed)return
 const event:SpanRecord={traceId:parsed.traceId,spanId:newSpanId(),parentSpanId:parsed.spanId,name:"component.render",layer:"component",status:"ok",durationMs:0,startedAt:new Date().toISOString(),attributes:{operation,source:"client"}}
 void fetch("/api/observability/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({events:[event]}),keepalive:true}).catch(()=>{})
}
export function recordRealtimeCommit(parent:string){
 const parsed=traceIdentity(parent);if(!parsed)return undefined
 const event:SpanRecord={traceId:parsed.traceId,spanId:newSpanId(),parentSpanId:parsed.spanId,name:"zustand.commit",layer:"zustand",status:"ok",durationMs:0,startedAt:new Date().toISOString(),attributes:{operation:"telemetry.read",source:"client"}}
 void fetch("/api/observability/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({events:[event]}),keepalive:true}).catch(()=>{})
 return traceHeader(event)
}
