"use client"
import * as React from "react"
import {useThread,useThreadList} from "@openuidev/react-headless"
import {ArrowUp,Database,FileSearch,Paperclip,Square} from "lucide-react"
import {Button,Textarea} from "@/components/atoms"
import {AttachmentChip} from "@/components/molecules/attachment-chip"
import {useChatAttachments} from "@/components/organisms/chat-attachments"
import {ATTACHMENT_ACCEPT,MAX_ATTACHMENTS,canImportAttachment} from "@/lib/attachment-policy"

export function ChatComposer(){
  const processMessage=useThread(s=>s.processMessage),running=useThread(s=>s.isRunning),cancel=useThread(s=>s.cancelMessage),threadId=useThreadList(s=>s.selectedThreadId)
  const {files,uploading,uploadLabel,errors,uploadFiles,removeFile,reset,reportError,setBlocked}=useChatAttachments()
  const [text,setText]=React.useState(""),[mode,setMode]=React.useState<"analyze"|"import">("analyze")
  const picker=React.useRef<HTMLInputElement>(null)
  React.useEffect(()=>{setText("");setMode("analyze");reset()},[threadId,reset])
  React.useEffect(()=>{setBlocked(running);return()=>setBlocked(false)},[running,setBlocked])
  const importable=files.some(file=>canImportAttachment(file.name))
  React.useEffect(()=>{if(!importable)setMode("analyze")},[importable])
  const send=async()=>{
    if(running||uploading||(!text.trim()&&!files.length))return
    if(mode==="import"&&!importable){reportError("Anexe um CSV, XLSX ou JSON com leituras para preparar a importação.");return}
    const instructions=mode==="import"
      ?"Prepare a importação dos anexos CSV, XLSX ou JSON com leituras de telemetria. Normalize os campos, valide datas e números, mostre uma prévia e aguarde minha confirmação antes de adicionar dados."
      :"Analise os arquivos anexados e resuma o conteúdo. Use tabelas e gráficos quando os dados permitirem."
    const question=mode==="import"?`${instructions}${text.trim()?`\n\nOrientações adicionais: ${text.trim()}`:""}`:text.trim()||instructions
    const content=question+files.map(file=>`\n[Anexo: ${file.name}; arquivo_id: ${file.id}]`).join("")
    setText("");setMode("analyze");reset()
    try{await processMessage({role:"user",content})}catch(error){reportError(error instanceof Error?error.message:"Falha ao enviar mensagem")}
  }
  return <div className="w-full space-y-2">
    <div className="rounded-2xl border bg-background p-3 shadow-sm">
      {files.length>0&&<div className="mb-3 space-y-3">
        <div className="flex flex-wrap gap-2">{files.map(file=><AttachmentChip key={file.id} file={file} disabled={running||uploading} onRemove={()=>removeFile(file.id)}/>)}</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Como usar os anexos">
          <Button variant={mode==="analyze"?"secondary":"ghost"} size="sm" aria-pressed={mode==="analyze"} disabled={running||uploading} onClick={()=>setMode("analyze")}><FileSearch className="size-3.5"/>Analisar arquivos</Button>
          <Button variant={mode==="import"?"secondary":"ghost"} size="sm" aria-pressed={mode==="import"} disabled={running||uploading||!importable} onClick={()=>setMode("import")}><Database className="size-3.5"/>Adicionar leituras</Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{mode==="import"?"CSV, XLSX e JSON são validados e normalizados. Você revisa a prévia e confirma a importação no chat.":importable?"Os arquivos serão usados na análise. Para adicionar leituras à base, escolha Adicionar leituras ou peça na mensagem.":"Os anexos estão disponíveis para análise. Para adicionar leituras à base, anexe um CSV, XLSX ou JSON de telemetria."}</p>
      </div>}
      <Textarea aria-label="Mensagem ao copiloto" placeholder="Pergunte, arraste arquivos ou peça para adicionar leituras…" value={text} maxLength={4500} disabled={running} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send()}}} className="min-h-20 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"/>
      <div className="flex items-center justify-between gap-3">
        <input ref={picker} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" aria-label="Selecionar anexos" onChange={event=>{const selected=Array.from(event.target.files??[]);event.target.value="";void uploadFiles(selected)}}/>
        <Button variant="ghost" size="sm" disabled={running||uploading||files.length>=MAX_ATTACHMENTS} onClick={()=>picker.current?.click()}><Paperclip className="size-4"/>{uploading?uploadLabel:"Anexar arquivo"}</Button>
        {running?<Button size="icon" variant="outline" onClick={cancel} aria-label="Interromper geração"><Square className="size-4"/></Button>:<Button size="icon" disabled={uploading||(!text.trim()&&!files.length)} onClick={()=>void send()} aria-label={mode==="import"?"Preparar importação":"Enviar mensagem"}><ArrowUp className="size-4"/></Button>}
      </div>
    </div>
    <div aria-live="polite" className="sr-only">{uploading?uploadLabel:files.length?`${files.length} arquivo(s) anexado(s)`:""}</div>
    {errors.length>0&&<ul role="alert" className="space-y-1 text-sm text-destructive">{errors.map(error=><li key={error}>{error}</li>)}</ul>}
    <p className="text-center text-[11px] text-muted-foreground">Arraste CSV, XLSX, JSON, PDF com texto, TXT ou MD · até três arquivos de 5 MB · importações e edições exigem revisão</p>
  </div>
}
