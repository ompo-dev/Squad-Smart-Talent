"use client"
import * as React from "react"
import { AgentInterface,fetchLLM,restStorage,type AssistantMessageComponent,type UserMessageComponent } from "@openuidev/react-ui"
import { agUIAdapter,useThread,useThreadList } from "@openuidev/react-headless"
import { Plus,BrainCircuit,FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnalysisMessage,ChangeReviewCard } from "@/components/openui/analysis-message"
import { MarkdownMessage } from "@/components/markdown-message"
import type { ToolResult } from "@/lib/chat-types"
import {ChatComposer} from "@/components/organisms/chat-composer"
import {ChatAttachmentsProvider,ChatFileDropzone} from "@/components/organisms/chat-attachments"
import {ImportReviewCard} from "@/components/organisms/import-review-card"
import {commandFetch} from "@/lib/client/command-fetch"
import {tracedChatFetch} from "@/lib/client/traced-chat-fetch"
import {useTraceStore} from "@/lib/stores/trace-store"
import {recordComponentRender} from "@/lib/observability/client"

const llm=fetchLLM({url:"/api/chat",streamAdapter:agUIAdapter(),fetch:tracedChatFetch})
const storage=restStorage({baseUrl:"/api/threads",fetch:commandFetch})
const starters=[
  {displayText:"Resumo da frota",prompt:"Consulte o resumo completo da frota e apresente os indicadores reais em cards."},
  {displayText:"Investigar alertas",prompt:"Quais máquinas concentram leituras em alerta? Consulte get_alerts e mostre a tabela."},
  {displayText:"Comparar temperaturas",prompt:"Gere um gráfico de média e máxima da temperatura por dia, com o período real da base."},
]
const AttachmentPattern=/\n?\[Anexo: (.*?); arquivo_id: ([a-f0-9-]+)\]/g
const cleanQuestion=(text:string)=>text.replace(AttachmentPattern,"").trim()

const UserBubble:UserMessageComponent=({message})=>{
  const text=typeof message.content==="string"?message.content:"",files=[...text.matchAll(AttachmentPattern)]
  return <div className="ml-auto max-w-[90%] space-y-2 rounded-2xl bg-muted px-4 py-3 text-sm"><p className="whitespace-pre-wrap break-words">{cleanQuestion(text)}</p>{files.map(file=><span key={file[2]} className="inline-flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-xs"><FileText className="size-3.5"/>{file[1]}</span>)}</div>
}
const AssistantAnswer:AssistantMessageComponent=({message,isStreaming})=>{
  const messages=useThread(s=>s.messages),processMessage=useThread(s=>s.processMessage),busy=useThread(s=>s.isRunning)
  const messageIndex=messages.findIndex(item=>item.id===message.id),userId=messages.slice(0,messageIndex).findLast(item=>item.role==="user")?.id
  const parent=useTraceStore(state=>userId?state.parents[userId]:undefined)
  React.useEffect(()=>{if(parent&&!isStreaming)recordComponentRender(parent,"chat.analysis")},[parent,isStreaming])
  const results=React.useMemo(()=>{
    const index=messages.findIndex(m=>m.id===message.id)
    let start=index;while(start>0&&messages[start]?.role!=="user") start--
    let end=index+1;while(end<messages.length&&messages[end].role!=="user") end++
    return messages.slice(Math.max(0,start),end).flatMap(m=>{if(m.role!=="tool")return [];try {const result=JSON.parse(m.content) as ToolResult;return result.id&&result.name&&result.data?[result]:[]}catch{return []}})
  },[messages,message.id])
  const content=message.content??"",ask=(question:string)=>{void processMessage({role:"user",content:question})}
  const openui=/^\s*root\s*=/.test(content)
  return <div className="min-w-0 space-y-4 py-2">{openui?<AnalysisMessage content={content} results={results} onAsk={ask} busy={busy} isStreaming={isStreaming}/>:<MarkdownMessage content={content}/>} {!isStreaming&&!content.includes("ChangeReview(")&&results.filter(r=>r.data.change).map(r=><ChangeReviewCard key={r.id} change={r.data.change!}/>)}{!isStreaming&&(!openui||!/\bImportReview\s*\(/.test(content))&&results.filter(result=>result.data.importPreview).map(result=><ImportReviewCard key={result.id} preview={result.data.importPreview!} disabled={busy}/>)}</div>
}

function NewConversation() {
  const create=useThreadList(s=>s.switchToNewThread),running=useThread(s=>s.isRunning)
  return <Button variant="outline" className="w-full justify-start" disabled={running} onClick={create}><Plus className="size-4"/>Nova conversa</Button>
}
function WelcomeIntro() {
  const send=useThread(s=>s.processMessage),running=useThread(s=>s.isRunning)
  return <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-6 py-6 text-center"><BrainCircuit className="size-10 text-primary"/><h2 className="text-2xl font-semibold tracking-tight">O que vamos investigar?</h2><p className="max-w-md text-sm leading-6 text-muted-foreground">Arraste arquivos para analisar, adicionar leituras ou revisar alterações. O copiloto organiza os dados em tabelas, indicadores e gráficos.</p><div className="mt-3 grid w-full gap-3 sm:grid-cols-3">{starters.map(starter=><Button key={starter.displayText} variant="outline" disabled={running} className="h-auto min-h-16 whitespace-normal px-4 py-4" onClick={()=>void send({role:"user",content:starter.prompt})}>{starter.displayText}</Button>)}</div></div>
}
function LegacyHistoryMigration() {
  const reload=useThreadList(s=>s.loadThreads)
  React.useEffect(()=>{
    if(localStorage.getItem("telemetry-conversations-migrated"))return
    let old:unknown
    try {old=JSON.parse(localStorage.getItem("telemetry-openui-chat-v1")??"[]")}catch{return}
    if(!Array.isArray(old)||!old.length)return
    fetch("/api/threads/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:old})}).then(res=>{if(res.ok){localStorage.setItem("telemetry-conversations-migrated","1");reload()}}).catch(()=>{})
  },[reload])
  return null
}

export function CopilotPage() {
  return <ChatAttachmentsProvider><ChatFileDropzone className="telemetry-agent h-[calc(100dvh-212px)] min-h-[420px] overflow-hidden rounded-2xl border bg-background"><AgentInterface llm={llm} storage={storage} agentName="Copiloto de dados" components={{AssistantMessage:AssistantAnswer,UserMessage:UserBubble}} starters={starters} starterVariant="card" scrollVariant="always" theme={{mode:"light"}}>
    <LegacyHistoryMigration/>
    <AgentInterface.Sidebar><AgentInterface.SidebarHeader agentName={<span className="openui-agent-sidebar-header__agent-name">Conversas</span>}/><AgentInterface.SidebarContent><div className="px-3 pb-4"><NewConversation/></div><AgentInterface.ThreadList/></AgentInterface.SidebarContent><AgentInterface.SidebarFooter><p className="px-3 py-2 text-xs text-muted-foreground">Conversas salvas no PostgreSQL</p></AgentInterface.SidebarFooter></AgentInterface.Sidebar>
    <AgentInterface.ThreadHeader end={<span className="text-xs text-muted-foreground">Base de telemetria · ferramentas ativas</span>}/>
    <AgentInterface.Welcome><WelcomeIntro/></AgentInterface.Welcome>
    <AgentInterface.Composer><ChatComposer/></AgentInterface.Composer>
  </AgentInterface></ChatFileDropzone></ChatAttachmentsProvider>
}
