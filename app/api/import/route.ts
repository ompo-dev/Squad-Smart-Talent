import {tracedRoute} from "@/lib/observability/server"
import {importTelemetry} from "@/lib/application/import-telemetry"
import {commandResponse} from "@/lib/application/http-commands"
import {revalidatePath} from "next/cache"
import {submitImport} from "@/lib/application/import-jobs"
async function handlePOST(request:Request) {
 const form=await request.formData().catch(()=>null),file=form?.get("file")
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".csv")||file.size>5*1024*1024)return Response.json({error:"Selecione um CSV de até 5 MB"},{status:400})
 const content=await file.text()
 if(file.size>65536||new URL(request.url).searchParams.get("async")==="true"){
   const response=await commandResponse(()=>submitImport(content,file.name,request.headers.get("Idempotency-Key")??undefined));if(response.ok){const data=await response.json();return Response.json(data,{status:202,headers:{Location:`/api/jobs/${data.jobId}`}})}return response
 }
 return commandResponse(async()=>{const result=await importTelemetry(content,request.headers.get("Idempotency-Key")??undefined);revalidatePath("/dashboard","layout");return result})
}

export const POST=tracedRoute("POST /api/import",handlePOST)
