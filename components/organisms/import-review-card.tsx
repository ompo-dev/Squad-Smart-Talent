"use client"
import * as React from "react"
import Link from "next/link"
import {useRouter} from "next/navigation"
import {CheckCircle2,Database,LoaderCircle} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle} from "@/components/ui/card"
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table"
import {useRealtimeStore} from "@/lib/stores/realtime-store"
import {useTelemetryStore} from "@/lib/stores/telemetry-store"
import type {AttachmentImportStatus,TelemetryImportPreview} from "@/lib/chat-types"

const decimal=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2})
const date=new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"})
export function ImportReviewCard({preview,disabled=false}:{preview:TelemetryImportPreview;disabled?:boolean}){
  const [state,setState]=React.useState<AttachmentImportStatus>({status:"pending"}),[saving,setSaving]=React.useState(false),[error,setError]=React.useState("")
  const [refresh,setRefresh]=React.useState(0),sequence=useRealtimeStore(store=>store.sequence),router=useRouter()
  const requestVersion=React.useRef(0)
  React.useEffect(()=>{
    if(saving)return
    const controller=new AbortController();let active=true,checking=false
    async function check(){
      if(checking)return;checking=true
      const version=requestVersion.current
      try{
        const response=await fetch("/api/import/attachment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status",fileId:preview.fileId,previewHash:preview.hash}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])})
        const data=await response.json()
        if(!response.ok)throw new Error(data.error??"Não foi possível consultar a importação.")
        if(active&&version===requestVersion.current){setState(data);setError("")}
      }catch(error){if(active&&!controller.signal.aborted&&version===requestVersion.current)setError(error instanceof Error?error.message:"Falha ao consultar a importação.")}
      finally{checking=false}
    }
    void check()
    const timer=["queued","running"].includes(state.status)?setInterval(()=>void check(),1500):undefined
    return()=>{active=false;controller.abort();if(timer)clearInterval(timer)}
  },[preview.fileId,preview.hash,state.status,sequence,refresh,saving])
  React.useEffect(()=>{if(state.status==="completed"){useTelemetryStore.getState().invalidate();router.refresh()}},[state.status,router])
  async function confirm(){
    if(saving||disabled||state.status!=="pending")return
    requestVersion.current++
    setSaving(true);setError("")
    try{
      const response=await fetch("/api/import/attachment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"confirm",fileId:preview.fileId,previewHash:preview.hash}),signal:AbortSignal.timeout(45000)})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error??"Não foi possível iniciar a importação.")
      setState(data)
    }catch(error){setError(error instanceof Error?error.message:"Falha ao importar o arquivo.")}
    finally{setSaving(false)}
  }
  const processing=saving||["queued","running"].includes(state.status),completed=state.status==="completed"
  return <Card className={completed?"border-emerald-200":"border-amber-200"}>
    <CardHeader><CardTitle className="flex items-center gap-2">{completed?<CheckCircle2 className="size-4 text-emerald-600"/>:<Database className="size-4"/>}{completed?"Importação concluída":"Revisar novas leituras"}</CardTitle><CardDescription className="break-all">{preview.name}</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Recebidas",preview.received],["Válidas",preview.valid],["Duplicadas",preview.duplicates],["Inválidas",preview.invalid]].map(([label,value])=><div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{Number(value).toLocaleString("pt-BR")}</p></div>)}</div>
      <p className="text-xs leading-5 text-muted-foreground">Cabeçalhos, datas e números foram padronizados. Zeros, negativos, sentinelas e valores fora da faixa física viraram ausentes ({preview.quality.repairedCells.toLocaleString("pt-BR")} células corrigidas). {preview.quality.outlierCells.toLocaleString("pt-BR")} outliers foram sinalizados e {preview.quality.rowsWithoutSensors.toLocaleString("pt-BR")} linhas ficaram sem sensores. Registros idênticos são deduplicados por record_key.</p>
      <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Máquina</TableHead><TableHead>Linha</TableHead><TableHead>Coleta</TableHead><TableHead>Condição</TableHead><TableHead>Temp. refrig.</TableHead><TableHead>Vib. spindle</TableHead><TableHead>Parada</TableHead></TableRow></TableHeader><TableBody>{preview.sample.map(row=><TableRow key={row.recordKey}><TableCell className="font-medium">{row.machineId}</TableCell><TableCell>{row.assemblyLine}</TableCell><TableCell className="whitespace-nowrap">{date.format(new Date(row.timestamp))}</TableCell><TableCell>{row.status}</TableCell><TableCell>{row.coolantTemperature===null?"Ausente":`${decimal.format(row.coolantTemperature)} °C`}</TableCell><TableCell>{row.spindleVibration===null?"Ausente":`${decimal.format(row.spindleVibration)} µm`}</TableCell><TableCell>{row.downtime===null?"Ausente":row.downtime?"Sim":"Não"}</TableCell></TableRow>)}</TableBody></Table></div>
      <p className="text-[11px] leading-5 text-muted-foreground">Horários exibidos em Brasília. Datas sem fuso no arquivo são interpretadas como UTC.</p>
      {preview.errors.length>0&&<div className="rounded-lg bg-muted/50 p-3 text-xs"><p className="mb-1 font-medium">Linhas que precisam de atenção</p>{preview.errors.map(message=><p key={message}>{message}</p>)}</div>}
      {completed&&state.result&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.result.inserted.toLocaleString("pt-BR")} adicionadas · {state.result.existing.toLocaleString("pt-BR")} já existentes · {state.result.duplicates.toLocaleString("pt-BR")} duplicadas · {state.result.invalid.toLocaleString("pt-BR")} inválidas</p>}
      {state.error&&<p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {error&&<div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" onClick={()=>setRefresh(value=>value+1)}>Consultar novamente</Button></div>}
    </CardContent>
    <CardFooter className="flex flex-wrap justify-between gap-3"><Button disabled={disabled||processing||state.status!=="pending"} onClick={()=>void confirm()}>{processing&&<LoaderCircle className="size-4 animate-spin"/>}{completed?"Leituras processadas":state.status==="failed"?"Importação não concluída":state.status==="running"?"Adicionando leituras…":state.status==="queued"?"Aguardando processamento…":saving?"Enviando…":"Confirmar importação"}</Button><Link href="/dashboard/jobs" className="text-xs underline underline-offset-4">Acompanhar importações</Link></CardFooter>
  </Card>
}
