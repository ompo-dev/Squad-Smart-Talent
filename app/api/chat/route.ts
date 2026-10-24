import { z } from "zod"
import { runAgent } from "@/lib/chat-agent"
import { getMessages, saveMessages } from "@/lib/chat-db"
import type { Message, AssistantMessage } from "@openuidev/react-headless"
import type { ChatEvent } from "@/lib/chat-types"
export const runtime="nodejs"
export const maxDuration=180
const inputSchema=z.object({threadId:z.string().uuid(),messages:z.array(z.object({id:z.string().max(150),role:z.enum(["user","assistant","tool"]),content:z.string().max(120000).optional()}).passthrough()).min(1).max(500)})
export async function POST(request:Request) {
  const parsed=inputSchema.safeParse(await request.json().catch(()=>null))
  if(!parsed.success) return Response.json({error:"Conversa inválida"},{status:400})
  if(!process.env.DEEPSEEK_API_KEY) return Response.json({error:"DeepSeek não configurado"},{status:503})
  const {threadId}=parsed.data
  try {await getMessages(threadId)} catch {return Response.json({error:"Conversa não encontrada"},{status:404})}
  const messages=parsed.data.messages as Message[]
  const userIndex=messages.findLastIndex(message=>message.role==="user")
  const question=messages[userIndex]?.content
  if(typeof question!=="string"||!question.trim()||question.length>6000) return Response.json({error:"Pergunta de até 6.000 caracteres"},{status:400})
  const history=messages.slice(0,userIndex).flatMap(m=>(m.role==="user"||m.role==="assistant")&&typeof m.content==="string"?[{role:m.role,content:m.content.slice(0,24000)}]:[]).slice(-18)
  const attachmentRefs=[...new Set(messages.flatMap(m=>m.role==="user"&&typeof m.content==="string"?[...m.content.matchAll(/\[Anexo: .*?; arquivo_id: [a-f0-9-]+\]/g)].map(match=>match[0]):[]))].slice(-12)
  const questionWithFiles=question+(attachmentRefs.length?`\n\nAnexos disponíveis nesta conversa:\n${attachmentRefs.join("\n")}`:"")
  await saveMessages(threadId,messages)
  const assistant:AssistantMessage={id:crypto.randomUUID(),role:"assistant",content:"",toolCalls:[]}
  const output:Message[]=[...messages,assistant]
  const runId=crypto.randomUUID(),encoder=new TextEncoder()
  let answerStarted=false
  const stream=new ReadableStream({async start(controller){
    const send=(event:Record<string,unknown>)=>{if(!request.signal.aborted) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))}
    send({type:"RUN_STARTED",threadId,runId})
    const emit=(event:ChatEvent)=>{
      if(event.type==="tool_start") {
        assistant.toolCalls!.push({id:event.id,type:"function",function:{name:event.name,arguments:JSON.stringify(event.args)}})
        send({type:"TOOL_CALL_START",toolCallId:event.id,toolCallName:event.name,parentMessageId:assistant.id})
        send({type:"TOOL_CALL_ARGS",toolCallId:event.id,delta:JSON.stringify(event.args)})
        send({type:"TOOL_CALL_END",toolCallId:event.id})
      } else if(event.type==="tool_result") {
        const message={id:crypto.randomUUID(),role:"tool" as const,toolCallId:event.result.id,content:JSON.stringify(event.result)}
        output.push(message)
        send({type:"TOOL_CALL_RESULT",messageId:message.id,toolCallId:message.toolCallId,content:message.content,role:"tool"})
      } else if(event.type==="answer_delta") {
        if(!answerStarted) {answerStarted=true;send({type:"TEXT_MESSAGE_START",messageId:assistant.id,role:"assistant"})}
        assistant.content=(assistant.content??"")+event.delta
        send({type:"TEXT_MESSAGE_CONTENT",messageId:assistant.id,delta:event.delta})
      } else if(event.type==="answer") {
        assistant.content=event.content
        if(!answerStarted) {send({type:"TEXT_MESSAGE_START",messageId:assistant.id,role:"assistant"});send({type:"TEXT_MESSAGE_CONTENT",messageId:assistant.id,delta:event.content})}
        send({type:"TEXT_MESSAGE_END",messageId:assistant.id})
      }
    }
    try {await runAgent({question:questionWithFiles,history,stream:true},process.env.DEEPSEEK_API_KEY!,request.signal,emit)}
    catch(error) {
      const message=request.signal.aborted?"Análise interrompida.":error instanceof Error?error.message:"Falha na análise"
      assistant.content=message
      send({type:"RUN_ERROR",message})
    } finally {
      try {await saveMessages(threadId,output)} catch {send({type:"RUN_ERROR",message:"Não foi possível salvar esta resposta. Recarregue para verificar a conversa."})}
      send({type:"RUN_FINISHED",threadId,runId})
      try {controller.close()} catch { /* disconnected */ }
    }
  }})
  return new Response(stream,{headers:{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-store","X-Accel-Buffering":"no"}})
}
