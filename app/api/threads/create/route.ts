import {tracedRoute} from "@/lib/observability/server"
import { z } from "zod"
import { createThread } from "@/lib/chat-db"
import {commandResponse,requestCommandKey} from "@/lib/application/http-commands"
async function handlePOST(request:Request) {
  const input=z.object({messages:z.array(z.object({id:z.string(),role:z.literal("user"),content:z.string().max(6000)})).min(1).max(1)}).safeParse(await request.json().catch(()=>null))
  if(!input.success) return Response.json({error:"Mensagem inválida"},{status:400})
  return commandResponse(()=>createThread(input.data.messages[0],requestCommandKey(request)))
}

export const POST=tracedRoute("POST /api/threads/create",handlePOST)
