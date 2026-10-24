import {getImportJob} from "@/lib/application/import-jobs"
import {tracedRoute} from "@/lib/observability/server"
import {z} from "zod"
export const GET=tracedRoute("GET /api/jobs/:id",async(_:Request,{params}:{params:Promise<{id:string}>})=>{const {id}=await params;if(!z.string().uuid().safeParse(id).success)return Response.json({error:"ID inválido"},{status:400});const job=await getImportJob(id);return job?Response.json(job,{headers:{"Cache-Control":"no-store"}}):Response.json({error:"Importação não encontrada"},{status:404})})
