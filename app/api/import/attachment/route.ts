import {tracedRoute} from "@/lib/observability/server"
import {attachmentImportInput,attachmentImportStatus,confirmAttachmentImport,prepareAttachmentImport} from "@/lib/application/attachment-import"
import {commandResponse} from "@/lib/application/http-commands"
import {boundedBody,BodyTooLarge} from "@/lib/application/http-body"

export const POST=tracedRoute("POST /api/import/attachment",async request=>{
  let body:unknown
  try{body=JSON.parse(new TextDecoder().decode(await boundedBody(request,4096)))}
  catch(error){return Response.json({error:error instanceof BodyTooLarge?"Solicitação acima do limite":"Solicitação de importação inválida"},{status:error instanceof BodyTooLarge?413:400})}
  const parsed=attachmentImportInput.safeParse(body)
  if(!parsed.success)return Response.json({error:"Informe o arquivo, a ação e, para confirmar ou consultar, o identificador da prévia."},{status:400})
  const input=parsed.data
  if(input.action==="preview")return commandResponse(()=>prepareAttachmentImport(input.fileId))
  if(input.action==="status")return commandResponse(()=>attachmentImportStatus(input.fileId,input.previewHash))
  const response=await commandResponse(()=>confirmAttachmentImport(input.fileId,input.previewHash))
  if(!response.ok)return response
  const data=await response.json()
  return Response.json(data,{status:["queued","running"].includes(data.status)?202:200})
})
