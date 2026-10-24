import {tracedRoute} from "@/lib/observability/server"
import { z } from "zod"
import { getMessages } from "@/lib/chat-db"
async function handleGET(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!z.string().uuid().safeParse(id).success) return Response.json({error:"ID inválido"},{status:400})
  try { return Response.json(await getMessages(id),{headers:{"Cache-Control":"no-store"}}) }
  catch { return Response.json({error:"Conversa não encontrada"},{status:404}) }
}

export const GET=tracedRoute("GET /api/threads/get/:id",handleGET)
