import { z } from "zod"
import { createThread } from "@/lib/chat-db"
export async function POST(request:Request) {
  const input=z.object({messages:z.array(z.object({id:z.string(),role:z.literal("user"),content:z.string().max(6000)})).min(1).max(1)}).safeParse(await request.json().catch(()=>null))
  if(!input.success) return Response.json({error:"Mensagem inválida"},{status:400})
  return Response.json(await createThread(input.data.messages[0]))
}
