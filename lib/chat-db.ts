import {prisma} from "@/lib/prisma"
import {executeCommand,jsonValue} from "@/lib/application/command-bus"
import type {Message,Thread} from "@openuidev/react-headless"
const asThread=(row:{id:string;title:string;createdAt:Date}):Thread=>({id:row.id,title:row.title,createdAt:row.createdAt.toISOString()})
export async function listThreads():Promise<Thread[]> {return (await prisma.chatThread.findMany({orderBy:{updatedAt:"desc"},take:100})).map(asThread)}
export async function createThread(message:Message,key?:string) {
  return executeCommand({type:"conversation.create",idempotencyKey:key??message.id,payload:{message}},async(tx,{message})=>asThread(await tx.chatThread.create({data:{id:crypto.randomUUID(),title:(typeof message.content==="string"?message.content:"Conversa com anexos").slice(0,70),messages:jsonValue([message])}})))
}
export async function renameThread(id:string,title:string,key?:string) {
  return executeCommand({type:"conversation.rename",idempotencyKey:key,payload:{id,title}},async(tx,payload)=>asThread(await tx.chatThread.update({where:{id:payload.id},data:{title:payload.title,updatedAt:new Date()}})))
}
export async function deleteThread(id:string,key?:string) {
  return executeCommand({type:"conversation.delete",idempotencyKey:key??id,payload:{id}},async(tx,payload)=>{await tx.chatRun.deleteMany({where:{threadId:payload.id}});await tx.chatThread.deleteMany({where:{id:payload.id}});return {deleted:true}})
}
export async function getMessages(id:string):Promise<Message[]> {
  const thread=await prisma.chatThread.findUniqueOrThrow({where:{id},select:{messages:true}})
  return thread.messages as unknown as Message[]
}
export async function saveMessages(id:string,messages:Message[]) {await prisma.chatThread.update({where:{id},data:{messages:jsonValue(messages),updatedAt:new Date()}})}
