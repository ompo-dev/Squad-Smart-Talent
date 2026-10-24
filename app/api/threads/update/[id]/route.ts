import { z } from "zod"
import { ensureChatSchema } from "@/lib/chat-db"
import { pool } from "@/lib/agent-tools"
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  const parsed=z.object({title:z.string().trim().min(1).max(100)}).safeParse(await request.json().catch(()=>null))
  if(!z.string().uuid().safeParse(id).success||!parsed.success) return Response.json({error:"Título inválido"},{status:400})
  await ensureChatSchema()
  const result=await pool.query('UPDATE chat_threads SET title=$2,updated_at=now() WHERE id=$1 RETURNING id,title,created_at AS "createdAt"',[id,parsed.data.title])
  return result.rowCount ? Response.json(result.rows[0]) : Response.json({error:"Conversa não encontrada"},{status:404})
}
