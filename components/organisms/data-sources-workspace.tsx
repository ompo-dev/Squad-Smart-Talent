"use client"

import {useEffect,useState} from "react"
import Link from "next/link"
import {Activity,ArrowRight,Check,Copy,Database,FileSpreadsheet,Globe,Radio,Webhook} from "lucide-react"
import {Badge} from "@/components/ui/badge"
import {Button,buttonVariants} from "@/components/ui/button"
import {Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle} from "@/components/ui/card"
import {DataImportForm} from "@/components/organisms/data-import-form"
import {useRealtimeStore} from "@/lib/stores/realtime-store"

type DataSourcesProps={
  readings:number
  lastReadingAt:string|null
  lastImport:{filename:string|null;at:string}|null
  lastWebhookAt:string|null
  webhookEnabled:boolean
}

function dateLabel(value:string|null){
  return value?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value)):"Nenhum registro"
}

export function DataSourcesWorkspace({readings,lastReadingAt,lastImport,lastWebhookAt,webhookEnabled}:DataSourcesProps){
  const connected=useRealtimeStore(state=>state.connected)
  const [endpoint,setEndpoint]=useState("/api/webhooks/telemetry")
  const [copied,setCopied]=useState(false)
  const [copyError,setCopyError]=useState("")
  useEffect(()=>setEndpoint(new URL("/api/webhooks/telemetry",window.location.origin).href),[])
  useEffect(()=>{if(!copied)return;const timer=setTimeout(()=>setCopied(false),2500);return()=>clearTimeout(timer)},[copied])

  async function copyEndpoint(){
    try{await navigator.clipboard.writeText(endpoint);setCopied(true);setCopyError("")}
    catch{setCopyError("Não foi possível copiar. Selecione e copie o endereço acima.")}
  }

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card size="sm"><CardHeader><CardDescription className="flex items-center gap-2"><Database className="size-4"/>Leituras recebidas</CardDescription><CardTitle className="text-3xl tabular-nums">{readings.toLocaleString("pt-BR")}</CardTitle></CardHeader><CardFooter className="text-xs text-muted-foreground">Dados disponíveis para painéis e copiloto</CardFooter></Card>
      <Card size="sm"><CardHeader><CardDescription>Última coleta registrada</CardDescription><CardTitle className="text-xl tabular-nums">{dateLabel(lastReadingAt)}</CardTitle></CardHeader><CardFooter className="text-xs text-muted-foreground">Data da medição · horário de Brasília</CardFooter></Card>
      <Card size="sm" className="sm:col-span-2 xl:col-span-1"><CardHeader><CardDescription className="flex items-center gap-2"><Radio className="size-4"/>Atualização dos painéis</CardDescription><CardTitle className="flex items-center gap-2 text-xl"><span className={`size-2 rounded-full ${connected?"bg-emerald-500":"bg-amber-500"}`}/>{connected?"Conectada":"Reconectando"}</CardTitle></CardHeader><CardFooter className="text-xs text-muted-foreground">{connected?"Novas leituras aparecem automaticamente":"A atualização automática aguarda conexão"}</CardFooter></Card>
    </div>

    <div className="flex gap-3 rounded-xl border bg-card p-4">
      <Activity className="mt-0.5 size-5 shrink-0 text-primary"/>
      <div className="space-y-1 text-sm"><p className="font-medium">Da origem ao painel</p><p className="leading-6 text-muted-foreground">Arquivos e integrações alimentam a mesma base. Quando novas leituras são recebidas, os painéis conectados são atualizados. A frequência dos dados depende da fonte; confira a data da última coleta.</p></div>
    </div>

    <div className="grid items-start gap-5 xl:grid-cols-3">
      <Card className="h-full"><CardHeader><div className="mb-3 flex items-center justify-between gap-2"><div className="rounded-lg bg-muted p-2.5"><FileSpreadsheet className="size-5"/></div><Badge variant="secondary">Importação manual</Badge></div><CardTitle>Arquivos CSV</CardTitle><CardDescription>Importe coletas históricas ou lotes exportados de outros sistemas.</CardDescription></CardHeader><CardContent className="space-y-5"><DataImportForm/><div className="rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">Indicado para cargas iniciais e arquivos recebidos periodicamente. Cada linha representa uma leitura de máquina.</div></CardContent><CardFooter className="mt-auto"><Link href="/dashboard/jobs" className="flex items-center gap-2 text-sm font-medium hover:underline">Acompanhar importações<ArrowRight className="size-4"/></Link></CardFooter></Card>

      <Card className="h-full"><CardHeader><div className="mb-3 flex items-center justify-between gap-2"><div className="rounded-lg bg-muted p-2.5"><Globe className="size-5"/></div><Badge variant="outline">Fonte a definir</Badge></div><CardTitle>APIs externas</CardTitle><CardDescription>Busque leituras em plataformas IoT, ERPs ou outros sistemas.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm"><p className="leading-6 text-muted-foreground">Uma integração pode consultar a API de origem em intervalos definidos e enviar as leituras para este workspace.</p><div className="rounded-lg border border-dashed p-4"><p className="font-medium">Nenhuma API externa conectada</p><p className="mt-2 text-xs leading-5 text-muted-foreground">A consulta automática precisa de um conector para a fonte escolhida, com endereço, autenticação, frequência e mapeamento dos campos.</p></div><ul className="space-y-2 text-xs text-muted-foreground"><li>Endereço e credenciais da API de origem</li><li>Intervalo de atualização da coleta</li><li>Identificador, máquina, data e sensores de cada leitura</li></ul></CardContent><CardFooter className="mt-auto"><Link href="/docs" className="flex items-center gap-2 text-sm font-medium hover:underline">Explorar contrato de integração<ArrowRight className="size-4"/></Link></CardFooter></Card>

      <Card className="h-full"><CardHeader><div className="mb-3 flex items-center justify-between gap-2"><div className="rounded-lg bg-muted p-2.5"><Webhook className="size-5"/></div><Badge variant={webhookEnabled?"secondary":"outline"}>{webhookEnabled?"Pronto para receber":"Configuração pendente"}</Badge></div><CardTitle>Webhooks</CardTitle><CardDescription>Receba eventos assim que a origem gerar uma nova leitura.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm"><p className="leading-6 text-muted-foreground">Seu sistema envia os dados para o endereço de recebimento. Os painéis conectados acompanham as mudanças automaticamente.</p><div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Endereço de recebimento · POST</p><code className="block select-all break-all rounded-lg border bg-muted/40 p-3 text-xs leading-5">{endpoint}</code><Button variant="outline" size="sm" onClick={()=>void copyEndpoint()}>{copied?<Check className="size-3.5"/>:<Copy className="size-3.5"/>}{copied?"Copiado":"Copiar endereço"}</Button><span role="status" className="sr-only">{copied?"Endereço copiado":""}</span>{copyError&&<p role="alert" className="text-xs text-destructive">{copyError}</p>}</div><p className="text-xs leading-5 text-muted-foreground">{webhookEnabled?"Recebimento habilitado. Configure a assinatura no sistema de origem para começar a enviar eventos.":"Configure o segredo de assinatura no servidor para habilitar o recebimento."} Os envios usam assinatura HMAC e aceitam até 500 leituras por lote.</p></CardContent><CardFooter className="mt-auto"><Link href="/docs#/Integra%C3%A7%C3%B5es/receiveTelemetryWebhook" className={buttonVariants({variant:"outline",size:"sm"})}>Como enviar eventos<ArrowRight className="size-4"/></Link></CardFooter></Card>
    </div>

    <Card><CardHeader><CardTitle>Últimos recebimentos</CardTitle><CardDescription>O recebimento de um arquivo ou evento pode trazer medições de datas anteriores.</CardDescription></CardHeader><CardContent><div className="divide-y">
      <div className="flex flex-col justify-between gap-2 py-3 first:pt-0 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-3"><FileSpreadsheet className="size-4 shrink-0 text-muted-foreground"/><div className="min-w-0"><p className="text-sm font-medium">Importação de arquivo</p><p className="break-all text-xs text-muted-foreground">{lastImport?.filename??(lastImport?"Arquivo recebido":"Nenhum arquivo importado")}</p></div></div>{lastImport&&<time dateTime={lastImport.at} className="shrink-0 text-xs text-muted-foreground">{dateLabel(lastImport.at)}</time>}</div>
      <div className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><Webhook className="size-4 shrink-0 text-muted-foreground"/><div><p className="text-sm font-medium">Eventos por webhook</p><p className="text-xs text-muted-foreground">{lastWebhookAt?"Último lote recebido":"Nenhum evento recebido"}</p></div></div>{lastWebhookAt&&<time dateTime={lastWebhookAt} className="shrink-0 text-xs text-muted-foreground">{dateLabel(lastWebhookAt)}</time>}</div>
    </div></CardContent></Card>
  </div>
}
