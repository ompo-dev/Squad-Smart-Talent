"use client"
import {startClientFlow} from "@/lib/observability/client"
import {useTraceStore} from "@/lib/stores/trace-store"
export const tracedChatFetch:typeof fetch=async(input,init)=>{
 const flow=startClientFlow("chat.analysis","component.chat"),headers=new Headers(init?.headers)
 flow.mark("zustand.dispatch");headers.set("traceparent",flow.header())
 let userId="",finished=false
 try{const messages=JSON.parse(String(init?.body)).messages as {id:string;role:string}[];userId=messages.findLast(message=>message.role==="user")?.id??""}catch{/* no message body is recorded */}
 const finish=(failed=false)=>{if(finished)return;finished=true;const parent=flow.mark(failed?"zustand.rollback":"zustand.commit",failed?"error":"ok");if(userId)useTraceStore.getState().remember(userId,parent);flow.flush(failed?"error":"ok")}
 try{
   const response=await fetch(input,{...init,headers});flow.serverParent(response.headers.get("traceparent"))
   if(!response.ok||!response.body){finish(!response.ok);return response}
   flow.mark("zustand.streaming")
   const reader=response.body.getReader()
   const body=new ReadableStream<Uint8Array>({async pull(controller){try{const chunk=await reader.read();if(chunk.done){finish();reader.releaseLock();controller.close()}else controller.enqueue(chunk.value)}catch(error){finish(true);controller.error(error)}},async cancel(reason){finish(true);await reader.cancel(reason)}})
   return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers})
 }catch(error){finish(true);throw error}
}
