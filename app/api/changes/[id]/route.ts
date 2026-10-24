import { z } from "zod"
import { pool } from "@/lib/agent-tools"
import { ensureChatSchema } from "@/lib/chat-db"
import { applyChange } from "@/lib/telemetry-edits"
import { revalidatePath } from "next/cache"
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!z.string().uuid().safeParse(id).success) return Response.json({error:"ID inválido"},{status:400})
  await ensureChatSchema()
  const found=await pool.query("SELECT status FROM telemetry_changes WHERE id=$1",[id])
  return found.rowCount ? Response.json(found.rows[0]) : Response.json({error:"Proposta não encontrada"},{status:404})
}
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!z.string().uuid().safeParse(id).success) return Response.json({error:"ID inválido"},{status:400})
  try {const result=await applyChange(id);revalidatePath("/dashboard","layout");return Response.json(result)} catch(error) {return Response.json({error:error instanceof Error?error.message:"Falha ao salvar alteração"},{status:409})}
}
