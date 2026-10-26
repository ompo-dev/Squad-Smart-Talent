"use client"

import * as React from "react"
import {FileUp} from "lucide-react"
import {selectAttachmentFiles} from "@/lib/attachment-policy"

export type ChatAttachment={id:string;name:string;size:number;localFile:{name:string;size:number;lastModified:number}}
type AttachmentsContextValue={
  files:ChatAttachment[];uploading:boolean;uploadLabel:string;errors:string[];blocked:boolean
  uploadFiles:(files:File[])=>Promise<void>;removeFile:(id:string)=>void;reset:()=>void
  reportError:(message:string)=>void;setBlocked:(blocked:boolean)=>void
}
const AttachmentsContext=React.createContext<AttachmentsContextValue|null>(null)
export function useChatAttachments(){
  const context=React.useContext(AttachmentsContext)
  if(!context)throw new Error("Chat attachments provider is missing")
  return context
}
export function ChatAttachmentsProvider({children}:{children:React.ReactNode}){
  const [files,setFiles]=React.useState<ChatAttachment[]>([]),[uploading,setUploading]=React.useState(false),[uploadLabel,setUploadLabel]=React.useState("")
  const [errors,setErrors]=React.useState<string[]>([]),[blocked,setBlockedState]=React.useState(false)
  const current=React.useRef<ChatAttachment[]>([]),locked=React.useRef(false),blockedRef=React.useRef(false),generation=React.useRef(0),controller=React.useRef<AbortController|null>(null)
  const setBlocked=React.useCallback((value:boolean)=>{blockedRef.current=value;setBlockedState(value)},[])
  const reportError=React.useCallback((message:string)=>setErrors([message]),[])
  const reset=React.useCallback(()=>{generation.current++;controller.current?.abort();current.current=[];locked.current=false;setFiles([]);setUploading(false);setUploadLabel("");setErrors([])},[])
  React.useEffect(()=>()=>{generation.current++;controller.current?.abort()},[])
  const removeFile=React.useCallback((id:string)=>{if(locked.current||blockedRef.current)return;current.current=current.current.filter(file=>file.id!==id);setFiles(current.current)},[])
  const uploadFiles=React.useCallback(async(selected:File[])=>{
    if(locked.current||blockedRef.current){setErrors(["Aguarde o envio ou a resposta atual antes de anexar outros arquivos."]);return}
    const selection=selectAttachmentFiles(selected,current.current.map(file=>file.localFile))
    setErrors(selection.errors)
    if(!selection.accepted.length)return
    const batch=generation.current,abort=new AbortController(),failures=[...selection.errors]
    controller.current=abort;locked.current=true;setUploading(true)
    try{
      for(const [index,file] of selection.accepted.entries()){
        if(abort.signal.aborted||batch!==generation.current)break
        setUploadLabel(`Lendo ${index+1} de ${selection.accepted.length}…`)
        try{
          const form=new FormData();form.set("file",file)
          const response=await fetch("/api/uploads",{method:"POST",body:form,signal:abort.signal}),data=await response.json().catch(()=>null)
          if(!response.ok||!data?.id||typeof data.name!=="string")throw new Error(data?.error??"Não foi possível ler este arquivo.")
          if(abort.signal.aborted||batch!==generation.current)break
          if(!current.current.some(existing=>existing.id===data.id)){
            current.current=[...current.current,{id:data.id,name:data.name,size:data.size,localFile:{name:file.name,size:file.size,lastModified:file.lastModified}}]
            setFiles(current.current)
          }
        }catch(error){if(abort.signal.aborted)break;failures.push(`${file.name}: ${error instanceof Error?error.message:"Falha no envio."}`)}
      }
    }finally{
      if(batch===generation.current){locked.current=false;setUploading(false);setUploadLabel("");setErrors(failures);controller.current=null}
    }
  },[])
  return <AttachmentsContext.Provider value={{files,uploading,uploadLabel,errors,blocked,uploadFiles,removeFile,reset,reportError,setBlocked}}>{children}</AttachmentsContext.Provider>
}

export function ChatFileDropzone({children,className}:{children:React.ReactNode;className?:string}){
  const {uploadFiles,reportError,blocked,uploading}=useChatAttachments()
  const [dragging,setDragging]=React.useState(false),depth=React.useRef(0)
  const hasFiles=(event:React.DragEvent)=>Array.from(event.dataTransfer.types).includes("Files")
  const clear=()=>{depth.current=0;setDragging(false)}
  return <div className={`relative ${className??""}`}
    onDragEnter={event=>{if(!hasFiles(event))return;event.preventDefault();depth.current++;setDragging(true)}}
    onDragOver={event=>{if(!hasFiles(event))return;event.preventDefault();event.dataTransfer.dropEffect=blocked||uploading?"none":"copy"}}
    onDragLeave={event=>{if(!dragging)return;event.preventDefault();depth.current=Math.max(0,depth.current-1);if(!depth.current)setDragging(false)}}
    onDragEnd={clear}
    onDrop={event=>{
      if(!hasFiles(event))return
      event.preventDefault();event.stopPropagation();clear()
      if(Array.from(event.dataTransfer.items).some(item=>item.webkitGetAsEntry?.()?.isDirectory)){reportError("Solte arquivos individuais. Pastas não são aceitas.");return}
      const selected=Array.from(event.dataTransfer.files)
      if(!selected.length){reportError("Não foi possível acessar os arquivos. Use o botão Anexar arquivo.");return}
      void uploadFiles(selected)
    }}>
    {children}
    {dragging&&<div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/95 p-6 text-center backdrop-blur-sm" role="status"><div className="space-y-3"><FileUp className="mx-auto size-12 text-primary"/><p className="text-lg font-semibold">{blocked||uploading?"Aguarde a operação atual":"Solte os arquivos aqui"}</p><p className="max-w-sm text-sm text-muted-foreground">Analise o conteúdo ou prepare a adição de novas leituras. Até três arquivos de 5 MB cada.</p></div></div>}
  </div>
}
