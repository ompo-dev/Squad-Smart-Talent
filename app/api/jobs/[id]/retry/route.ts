import {retryImport} from "@/lib/application/import-jobs"
import {tracedRoute} from "@/lib/observability/server"
import {commandResponse,requestCommandKey} from "@/lib/application/http-commands"
import {z} from "zod"
export const POST=tracedRoute("POST /api/jobs/:id/retry",async(request:Request,{params}:{params:Promise<{id:string}>})=>{const {id}=await params;if(!z.string().uuid().safeParse(id).success)return Response.json({error:"ID inválido"},{status:400});return commandResponse(()=>retryImport(id,requestCommandKey(request)))})
