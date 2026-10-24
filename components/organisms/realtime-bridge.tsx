"use client"
import {useEffect} from "react"
import {useRouter} from "next/navigation"
import {useRealtimeStore} from "@/lib/stores/realtime-store"
import {useTelemetryStore} from "@/lib/stores/telemetry-store"
import {recordRealtimeCommit} from "@/lib/observability/client"
export function RealtimeBridge(){
 const router=useRouter()
 useEffect(()=>{
   let stopped=false,socket:WebSocket|undefined,timer:ReturnType<typeof setTimeout>|undefined,refresh:ReturnType<typeof setTimeout>|undefined,attempt=0,url=""
   const seen=new Set<string>()
   const reload=()=>{useTelemetryStore.getState().invalidate();if(refresh)clearTimeout(refresh);refresh=setTimeout(()=>router.refresh(),150)}
   const connect=()=>{if(stopped)return;socket=new WebSocket(url,"telemetry.events.v1");socket.onopen=()=>{attempt=0;useRealtimeStore.getState().update(true);reload()};socket.onmessage=event=>{try{const message=JSON.parse(event.data);if(!message.id||seen.has(message.id))return;seen.add(message.id);if(seen.size>500)seen.delete(seen.values().next().value!);if(["telemetry.changed","job.submit","job.completed","job.failed"].includes(message.type)){const parent=typeof message.traceparent==="string"?recordRealtimeCommit(message.traceparent):undefined;useRealtimeStore.getState().update(true,message.type,message.aggregateId,parent);if(message.type==="telemetry.changed")reload()}}catch{/* ignore malformed notifications */}};socket.onerror=()=>socket?.close();socket.onclose=()=>{useRealtimeStore.getState().update(false);if(!stopped)timer=setTimeout(connect,Math.min(30000,1000*2**attempt++))}}
   fetch("/api/realtime/config").then(response=>response.json()).then(config=>{url=config.url;connect()}).catch(()=>useRealtimeStore.getState().update(false))
   return()=>{stopped=true;if(timer)clearTimeout(timer);if(refresh)clearTimeout(refresh);socket?.close()}
 },[router])
 return null
}
