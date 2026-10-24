import {tracedRoute} from "@/lib/observability/server"
import { z } from "zod"
import {renameThread} from "@/lib/chat-db"
import {commandResponse,requestCommandKey} from "@/lib/application/http-commands"
async function handlePATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  const parsed=z.object({title:z.string().trim().min(1).max(100)}).safeParse(await request.json().catch(()=>null))
  if(!z.string().uuid().safeParse(id).success||!parsed.success) return Response.json({error:"Título inválido"},{status:400})
  return commandResponse(()=>renameThread(id,parsed.data.title,requestCommandKey(request)))
}

export const PATCH=tracedRoute("PATCH /api/threads/update/:id",handlePATCH)
