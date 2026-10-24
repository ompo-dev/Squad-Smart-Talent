import {tracedRoute} from "@/lib/observability/server"
import { z } from "zod"
import {deleteThread} from "@/lib/chat-db"
import {commandResponse,requestCommandKey} from "@/lib/application/http-commands"
async function handleDELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!z.string().uuid().safeParse(id).success) return Response.json({error:"ID inválido"},{status:400})
  return commandResponse(()=>deleteThread(id,requestCommandKey(request)))
}

export const DELETE=tracedRoute("DELETE /api/threads/delete/:id",handleDELETE)
