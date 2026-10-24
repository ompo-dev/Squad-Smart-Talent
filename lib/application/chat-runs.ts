import {prisma} from "@/lib/prisma"
import {payloadHash,jsonValue,CommandConflict} from "@/lib/application/command-bus"
import type {Message} from "@openuidev/react-headless"
export async function claimChatRun(id:string,threadId:string,question:string) {
 const hash=payloadHash({threadId,question})
 try {await prisma.chatRun.create({data:{id,threadId,payloadHash:hash}});return {kind:"new" as const,messages:[] as Message[]}}
 catch(error){if((error as {code?:string}).code!=="P2002")throw error}
 const run=await prisma.chatRun.findUniqueOrThrow({where:{id}})
 if(run.payloadHash!==hash)throw new CommandConflict("Mensagem já utilizada com outro conteúdo")
 return {kind:run.status==="running"?"running" as const:"replay" as const,messages:run.messages as unknown as Message[]}
}
export async function finishChatRun(id:string,threadId:string,allMessages:Message[],turnMessages:Message[]) {
 await prisma.$transaction([
   prisma.chatThread.update({where:{id:threadId},data:{messages:jsonValue(allMessages),updatedAt:new Date()}}),
   prisma.chatRun.update({where:{id},data:{status:"completed",messages:jsonValue(turnMessages)}}),
 ])
}
export function replayChatRun(threadId:string,messages:Message[]) {
 const runId=crypto.randomUUID(),events:Record<string,unknown>[]=[{type:"RUN_STARTED",threadId,runId}]
 const assistant=messages.find(m=>m.role==="assistant")
 if(assistant?.role==="assistant"){
   for(const call of assistant.toolCalls??[]){events.push({type:"TOOL_CALL_START",toolCallId:call.id,toolCallName:call.function.name,parentMessageId:assistant.id},{type:"TOOL_CALL_ARGS",toolCallId:call.id,delta:call.function.arguments},{type:"TOOL_CALL_END",toolCallId:call.id});const result=messages.find(m=>m.role==="tool"&&m.toolCallId===call.id);if(result?.role==="tool")events.push({type:"TOOL_CALL_RESULT",messageId:result.id,toolCallId:call.id,role:"tool",content:result.content})}
   events.push({type:"TEXT_MESSAGE_START",messageId:assistant.id,role:"assistant"},{type:"TEXT_MESSAGE_CONTENT",messageId:assistant.id,delta:assistant.content??""},{type:"TEXT_MESSAGE_END",messageId:assistant.id})
 }
 events.push({type:"RUN_FINISHED",threadId,runId})
 return new Response(events.map(event=>`data: ${JSON.stringify(event)}\n\n`).join(""),{headers:{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-store","Idempotency-Replayed":"true"}})
}
