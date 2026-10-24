import {tracedRoute} from "@/lib/observability/server"
import {validWebhookSignature,receiveTelemetryWebhook} from "@/lib/application/webhooks"
import {commandResponse} from "@/lib/application/http-commands"
import {boundedBody,BodyTooLarge} from "@/lib/application/http-body"
export const POST=tracedRoute("POST /api/webhooks/telemetry",async request=>{
 const secret=process.env.WEBHOOK_SECRET
 if(!secret||secret.length<32)return Response.json({error:"Webhook não configurado"},{status:503})
 let raw:Uint8Array;try{raw=await boundedBody(request,524288)}catch(error){if(error instanceof BodyTooLarge)return Response.json({error:"Lote excede 512 KiB"},{status:413});throw error}
 if(!validWebhookSignature(raw,request.headers.get("X-Webhook-Timestamp"),request.headers.get("X-Webhook-Signature"),secret))return Response.json({error:"Assinatura inválida ou expirada"},{status:401})
 return commandResponse(()=>receiveTelemetryWebhook(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw))))
})
