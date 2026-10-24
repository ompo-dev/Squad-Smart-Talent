"use client"
import * as React from "react"
import { AgentInterface,fetchLLM,restStorage,type AssistantMessageComponent,type UserMessageComponent } from "@openuidev/react-ui"
import { agUIAdapter,useThread,useThreadList } from "@openuidev/react-headless"
import { ArrowUp,Paperclip,Plus,Square,X,BrainCircuit,FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AnalysisMessage,ChangeReviewCard } from "@/components/openui/analysis-message"
import { MarkdownMessage } from "@/components/markdown-message"
import type { ToolResult } from "@/lib/chat-types"

const llm=fetchLLM({url:"/api/chat",streamAdapter:agUIAdapter()})
const storage=restStorage({baseUrl:"/api/threads"})
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
  const results=React.useMemo(()=>{
    const index=messages.findIndex(m=>m.id===message.id)
    let start=index;while(start>0&&messages[start]?.role!=="user") start--
    let end=index+1;while(end<messages.length&&messages[end].role!=="user") end++
    return messages.slice(Math.max(0,start),end).flatMap(m=>{if(m.role!=="tool")return [];try {const result=JSON.parse(m.content) as ToolResult;return result.id&&result.name&&result.data?[result]:[]}catch{return []}})
  },[messages,message.id])
  const content=message.content??"",ask=(question:string)=>{void processMessage({role:"user",content:question})}
  const openui=/^\s*root\s*=/.test(content)
  return <div className="min-w-0 space-y-4 py-2">{openui?<AnalysisMessage content={content} results={results} onAsk={ask} busy={busy} isStreaming={isStreaming}/>:<MarkdownMessage content={content}/>} {!isStreaming&&!content.includes("ChangeReview(")&&results.filter(r=>r.data.change).map(r=><ChangeReviewCard key={r.id} change={r.data.change!}/>)}</div>
}

type Attachment={id:string;name:string;size:number}
function ChatComposer() {
  const processMessage=useThread(s=>s.processMessage),running=useThread(s=>s.isRunning),cancel=useThread(s=>s.cancelMessage),threadId=useThreadList(s=>s.selectedThreadId)
  const [text,setText]=React.useState(""),[files,setFiles]=React.useState<Attachment[]>([]),[uploading,setUploading]=React.useState(false),[error,setError]=React.useState("")
  const picker=React.useRef<HTMLInputElement>(null)
  React.useEffect(()=>{setText("");setFiles([]);setError("")},[threadId])
  const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const selected=Array.from(event.target.files??[]);event.target.value=""
    if(files.length+selected.length>3){setError("Anexe até três arquivos por mensagem.");return}
    setUploading(true);setError("")
    try {for(const file of selected){const form=new FormData();form.set("file",file);const response=await fetch("/api/uploads",{method:"POST",body:form}),data=await response.json();if(!response.ok)throw new Error(`${file.name}: ${data.error}`);setFiles(current=>[...current,data])}}
    catch(error){setError(error instanceof Error?error.message:"Falha no envio do arquivo")}finally{setUploading(false)}
  }
  const send=async()=>{
    if(running||uploading||(!text.trim()&&!files.length)) return
    const content=(text.trim()||"Analise os arquivos anexados e resuma o conteúdo.")+files.map(file=>`\n[Anexo: ${file.name}; arquivo_id: ${file.id}]`).join("")
    setText("");setFiles([]);setError("")
    try {await processMessage({role:"user",content})}catch(error){setError(error instanceof Error?error.message:"Falha ao enviar mensagem")}
  }
  return <div className="w-full space-y-2"><div className="rounded-2xl border bg-background p-3 shadow-sm">{files.length>0&&<div className="mb-2 flex flex-wrap gap-2">{files.map(file=><span key={file.id} className="inline-flex max-w-full items-center gap-2 rounded-lg border bg-muted/50 px-2 py-1 text-xs"><FileText className="size-3.5 shrink-0"/><span className="truncate">{file.name}</span><button aria-label={`Remover ${file.name}`} disabled={running} onClick={()=>setFiles(current=>current.filter(f=>f.id!==file.id))}><X className="size-3.5"/></button></span>)}</div>}<Textarea aria-label="Mensagem ao copiloto" placeholder="Pergunte sobre os dados, anexe arquivos ou peça uma alteração específica…" value={text} maxLength={5000} disabled={running} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}} className="min-h-20 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"/><div className="flex items-center justify-between gap-3"><input ref={picker} type="file" multiple accept=".csv,.txt,.md,.json,.pdf,.xlsx" className="hidden" aria-label="Selecionar anexos" onChange={upload}/><Button variant="ghost" size="sm" disabled={running||uploading||files.length>=3} onClick={()=>picker.current?.click()}><Paperclip className="size-4"/>{uploading?"Lendo arquivo…":"Anexar arquivo"}</Button><div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">DeepSeek · streaming</span>{running?<Button size="icon" variant="outline" onClick={cancel} aria-label="Interromper geração"><Square className="size-4"/></Button>:<Button size="icon" disabled={uploading||(!text.trim()&&!files.length)} onClick={()=>void send()} aria-label="Enviar mensagem"><ArrowUp className="size-4"/></Button>}</div></div></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<p className="text-center text-[11px] text-muted-foreground">CSV, XLSX, PDF com texto, TXT, MD e JSON · até 5 MB por arquivo · edições exigem revisão</p></div>
}
function NewConversation() {
  const create=useThreadList(s=>s.switchToNewThread),running=useThread(s=>s.isRunning)
  return <Button variant="outline" className="w-full justify-start" disabled={running} onClick={create}><Plus className="size-4"/>Nova conversa</Button>
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
  return <div className="telemetry-agent h-[calc(100dvh-220px)] min-h-[620px] overflow-hidden rounded-2xl border bg-background"><AgentInterface llm={llm} storage={storage} agentName="Copiloto de dados" components={{AssistantMessage:AssistantAnswer,UserMessage:UserBubble}} starters={starters} starterVariant="card" scrollVariant="always" theme={{mode:"light"}}>
    <LegacyHistoryMigration/>
    <AgentInterface.Sidebar><AgentInterface.SidebarHeader agentName="Conversas" logo={<BrainCircuit size={20}/>}/><AgentInterface.SidebarContent><div className="px-3 pb-4"><NewConversation/></div><AgentInterface.ThreadList/></AgentInterface.SidebarContent><AgentInterface.SidebarFooter><p className="px-3 py-2 text-xs text-muted-foreground">Conversas salvas no PostgreSQL</p></AgentInterface.SidebarFooter></AgentInterface.Sidebar>
    <AgentInterface.ThreadHeader end={<span className="text-xs text-muted-foreground">Base importada · ferramentas ativas</span>}/>
    <AgentInterface.Welcome title="O que vamos investigar?" description="Explore sua telemetria, consulte anexos e revise alterações em uma conversa." image={<BrainCircuit className="size-10 text-primary"/>}/>
    <AgentInterface.Composer><ChatComposer/></AgentInterface.Composer>
  </AgentInterface></div>
}
