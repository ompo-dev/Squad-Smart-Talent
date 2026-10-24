import { z } from "zod"
import { ensureChatSchema } from "@/lib/chat-db"
import { pool } from "@/lib/agent-tools"
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!z.string().uuid().safeParse(id).success) return Response.json({error:"ID inválido"},{status:400})
  await ensureChatSchema()
  await pool.query("DELETE FROM chat_threads WHERE id=$1",[id])
  return new Response(null,{status:204})
}
