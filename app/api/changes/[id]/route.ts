import {tracedRoute} from "@/lib/observability/server"
import { z } from "zod"
import {prisma} from "@/lib/prisma"
import { applyChange } from "@/lib/telemetry-edits"
import { revalidatePath } from "next/cache"
import {requestCommandKey} from "@/lib/application/http-commands"
async function handleGET(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!z.string().uuid().safeParse(id).success) return Response.json({error:"ID inválido"},{status:400})
  const found=await prisma.telemetryChange.findUnique({where:{id},select:{status:true}})
  return found ? Response.json(found) : Response.json({error:"Proposta não encontrada"},{status:404})
}
async function handlePOST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!z.string().uuid().safeParse(id).success) return Response.json({error:"ID inválido"},{status:400})
  try {const result=await applyChange(id,request.headers.has("Idempotency-Key")?requestCommandKey(request):id);revalidatePath("/dashboard","layout");return Response.json(result)} catch(error) {return Response.json({error:error instanceof Error?error.message:"Falha ao salvar alteração"},{status:409})}
}

export const GET=tracedRoute("GET /api/changes/:id",handleGET)
export const POST=tracedRoute("POST /api/changes/:id",handlePOST)
