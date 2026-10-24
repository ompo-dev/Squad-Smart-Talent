"use client"
import * as React from "react"
import axios from "axios"
import {useRouter} from "next/navigation"
import {Button} from "@/components/atoms"
import {FileUp} from "lucide-react"
type ImportResult={inserted:number;existing:number;duplicates:number;invalid:number;errors:string[]}
export function DataImportForm(){
 const picker=React.useRef<HTMLInputElement>(null),requestId=React.useRef(crypto.randomUUID()),router=useRouter()
 const [file,setFile]=React.useState<File|null>(null),[busy,setBusy]=React.useState(false),[result,setResult]=React.useState<ImportResult|null>(null),[error,setError]=React.useState("")
 const [jobId,setJobId]=React.useState<string|null>(null),[jobStatus,setJobStatus]=React.useState("")
 React.useEffect(()=>{
   if(!jobId)return;let active=true,checking=false
   const check=async()=>{if(checking)return;checking=true;try{
     const {data}=await axios.get(`/api/jobs/${jobId}`);if(!active)return;setJobStatus(data.status)
     if(data.status==="completed"){setResult(data.result);setJobId(null);router.refresh()}
     else if(data.status==="failed"){setError(data.errorCode==="INVALID_CSV"?"O arquivo não contém leituras válidas. Verifique as datas e os campos.":"A importação falhou. Consulte as importações para repetir.");setJobId(null)}
   }catch{if(active)setError("Não foi possível acompanhar a importação. Consulte a página de importações.")}finally{checking=false}}
   void check();const timer=setInterval(()=>void check(),1500);return()=>{active=false;clearInterval(timer)}
 },[jobId,router])
 const upload=async()=>{
   if(!file||busy)return;setBusy(true);setError("");setResult(null)
   try{const body=new FormData();body.set("file",file)
     const {data}=await axios.post<ImportResult|{jobId:string;status:string}>("/api/import",body,{headers:{"Idempotency-Key":requestId.current}})
     if("jobId" in data){setJobId(data.jobId);setJobStatus(data.status)}else{setResult(data);router.refresh()}
   }catch(error){setError(axios.isAxiosError(error)?error.response?.data?.error??"Não foi possível importar o CSV":"Falha na importação")}finally{setBusy(false)}
 }
 return <div className="space-y-4">
   <input type="file" accept=".csv" aria-label="Arquivo CSV de telemetria" ref={picker} className="hidden" onChange={event=>{setFile(event.target.files?.[0]??null);requestId.current=crypto.randomUUID();setResult(null);setError("")}}/>
   <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>picker.current?.click()} disabled={busy}><FileUp className="size-4"/>{file?file.name:"Selecionar CSV"}</Button>{file&&<Button onClick={()=>void upload()} disabled={busy}>{busy?"Enviando…":"Importar leituras"}</Button>}</div>
   <p className="text-xs text-muted-foreground">Até 5 MB. Arquivos maiores são processados em fila. Leituras existentes são preservadas, incluindo edições realizadas no chat.</p>
   {jobId&&<div role="status" className="rounded-xl border bg-muted/40 p-4 text-sm"><p>{jobStatus==="running"?"Processando leituras…":"Arquivo na fila de importação"}</p><a className="text-xs underline" href="/dashboard/jobs">Acompanhar importações</a></div>}
   {result&&<div role="status" className="rounded-xl border bg-muted/40 p-4 text-sm"><p>{result.inserted} inseridas · {result.existing} já existentes · {result.duplicates} duplicadas no arquivo · {result.invalid} inválidas</p>{result.errors.map(item=><p key={item} className="mt-1 text-xs">{item}</p>)}</div>}
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 </div>
}
