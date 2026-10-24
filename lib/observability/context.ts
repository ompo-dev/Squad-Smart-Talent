export type Layer="component"|"zustand"|"api"|"command"|"next-cache"|"redis"|"postgres"|"agent"|"auth"|"worker"|"websocket"
export type SpanRecord={traceId:string;spanId:string;parentSpanId?:string;name:string;layer:Layer;status:"ok"|"error";durationMs:number;startedAt:string;attributes:Record<string,string|number|boolean>}
export function traceIdentity(header?:string|null) {
 const match=header?.match(/^00-([a-f0-9]{32})-([a-f0-9]{16})-0[01]$/)
 if(match&&!/^0+$/.test(match[1])&&!/^0+$/.test(match[2]))return {traceId:match[1],spanId:match[2]}
 return undefined
}
export const newTraceId=()=>crypto.randomUUID().replaceAll("-","")
export const newSpanId=()=>newTraceId().slice(0,16)
export const traceHeader=(trace:{traceId:string;spanId:string})=>`00-${trace.traceId}-${trace.spanId}-01`
const allowed=new Set(["operation","mode","outcome","revision","replayed","statusCode","source","count","errorType","origin","method","route","cacheAvailable"])
export function safeAttributes(input:Record<string,unknown>) {
 return Object.fromEntries(Object.entries(input).filter(([key,value])=>allowed.has(key)&&(["string","boolean"].includes(typeof value)||(typeof value==="number"&&Number.isFinite(value)))).map(([key,value])=>[key,typeof value==="string"?value.slice(0,120):value])) as SpanRecord["attributes"]
}
