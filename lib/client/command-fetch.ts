"use client"
import {startClientFlow} from "@/lib/observability/client"
export const commandFetch:typeof fetch=async(input,init)=>{
 const flow=startClientFlow("conversation.request","component.storage");flow.mark("zustand.dispatch")
 const headers=new Headers(init?.headers)
 headers.set("traceparent",flow.header())
 if(init?.method&&init.method!=="GET"&&!headers.has("Idempotency-Key")){
   let key=crypto.randomUUID()
   if(String(input).endsWith("/create"))try {key=JSON.parse(String(init.body)).messages[0].id}catch{/* fall back to request identity */}
   headers.set("Idempotency-Key",key)
 }
 try {const response=await fetch(input,{...init,headers});flow.serverParent(response.headers.get("traceparent"));flow.mark(response.ok?"zustand.commit":"zustand.rollback",response.ok?"ok":"error");flow.flush(response.ok?"ok":"error");return response}catch(error){flow.mark("zustand.rollback","error");flow.flush("error");throw error}
}
