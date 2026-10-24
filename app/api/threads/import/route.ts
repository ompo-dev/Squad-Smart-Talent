import {tracedRoute} from "@/lib/observability/server"
import {z} from "zod"
import {createThread,saveMessages} from "@/lib/chat-db"
import type {Message} from "@openuidev/react-headless"
const schema=z.object({messages:z.array(z.object({id:z.string(),role:z.enum(["user","assistant"]),content:z.string().max(40000),tools:z.array(z.object({id:z.string(),name:z.string(),args:z.record(z.string(),z.unknown()),data:z.record(z.string(),z.unknown())})).max(12).optional()})).min(1).max(50)})
async function handlePOST(request:Request) {
  const parsed=schema.safeParse(await request.json().catch(()=>null))
  if(!parsed.success)return Response.json({error:"Histórico antigo inválido"},{status:400})
  const first=parsed.data.messages.find(m=>m.role==="user")
  if(!first)return Response.json({error:"Histórico sem mensagens"},{status:400})
  const thread=await createThread({id:first.id,role:"user",content:first.content})
  const messages:Message[]=parsed.data.messages.flatMap((m):Message[]=>m.role==="user"?[{id:m.id,role:"user",content:m.content}]:[{id:m.id,role:"assistant",content:m.content,toolCalls:(m.tools??[]).map(t=>({id:t.id,type:"function",function:{name:t.name,arguments:JSON.stringify(t.args)}}))},...(m.tools??[]).map(t=>({id:crypto.randomUUID(),role:"tool" as const,toolCallId:t.id,content:JSON.stringify(t)}))])
  await saveMessages(thread.id,messages)
  return Response.json(thread)
}

export const POST=tracedRoute("POST /api/threads/import",handlePOST)
