"use client"
import * as React from "react"
import {useThread,useThreadList} from "@openuidev/react-headless"
import {ArrowUp,Paperclip,Square} from "lucide-react"
import {Button,Textarea} from "@/components/atoms"
import {AttachmentChip} from "@/components/molecules/attachment-chip"
type Attachment={id:string;name:string;size:number}
export function ChatComposer() {
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
  return <div className="w-full space-y-2"><div className="rounded-2xl border bg-background p-3 shadow-sm">{files.length>0&&<div className="mb-2 flex flex-wrap gap-2">{files.map(file=><AttachmentChip key={file.id} file={file} disabled={running} onRemove={()=>setFiles(current=>current.filter(f=>f.id!==file.id))}/>)}</div>}<Textarea aria-label="Mensagem ao copiloto" placeholder="Pergunte sobre os dados, anexe arquivos ou peça uma alteração específica…" value={text} maxLength={5000} disabled={running} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}} className="min-h-20 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"/><div className="flex items-center justify-between gap-3"><input ref={picker} type="file" multiple accept=".csv,.txt,.md,.json,.pdf,.xlsx" className="hidden" aria-label="Selecionar anexos" onChange={upload}/><Button variant="ghost" size="sm" disabled={running||uploading||files.length>=3} onClick={()=>picker.current?.click()}><Paperclip className="size-4"/>{uploading?"Lendo arquivo…":"Anexar arquivo"}</Button><div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">DeepSeek · streaming</span>{running?<Button size="icon" variant="outline" onClick={cancel} aria-label="Interromper geração"><Square className="size-4"/></Button>:<Button size="icon" disabled={uploading||(!text.trim()&&!files.length)} onClick={()=>void send()} aria-label="Enviar mensagem"><ArrowUp className="size-4"/></Button>}</div></div></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<p className="text-center text-[11px] text-muted-foreground">CSV, XLSX, PDF com texto, TXT, MD e JSON · até 5 MB por arquivo · edições exigem revisão</p></div>
}

