"use client"
import * as React from "react"
import { Renderer, createLibrary, defineComponent, type OpenUIError } from "@openuidev/react-lang"
import { AnalysisSpec, ChartResultSpec, DataResultSpec, FollowUpSpec, MetricSpec,ChangeReviewSpec,ImportReviewSpec } from "@/lib/openui-schema"
import {ImportReviewCard} from "@/components/organisms/import-review-card"
import { DataTable } from "@/components/data-table"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/atoms"
import { MarkdownMessage } from "@/components/markdown-message"
import type { ToolResult } from "@/lib/chat-types"
import {useCommandStore} from "@/lib/stores/command-store"
import {ChangeValues} from "@/components/molecules/change-values"
import {recordComponentRender} from "@/lib/observability/client"

const ResultContext = React.createContext<{ results: ToolResult[]; onAsk: (question: string) => void; busy: boolean }>({ results: [], onAsk: () => {}, busy: false })
function useResult(id: string) { return React.useContext(ResultContext).results.find((result) => result.id === id) }
const Metric = defineComponent({ ...MetricSpec, component: ({ props }) => <Card size="sm"><CardHeader><CardDescription>{props.label}</CardDescription><CardTitle className="text-2xl font-semibold">{props.value}</CardTitle><p className="text-xs text-muted-foreground">{props.note}</p></CardHeader></Card> })
const DataResult = defineComponent({ ...DataResultSpec, component: ({ props }) => {
  const result = useResult(props.resultId)
  if (!result || result.data.error) return <p className="text-sm text-muted-foreground">Resultado indisponível para esta tabela.</p>
  const readings = ["query_telemetry","get_alerts","analyze_uploaded_telemetry"].includes(result.name)
  const rows = (result.data.rows ?? []).map((row, index) => readings ? {
    id: Number(row.id ?? index + 1), header: String(row.machine_id ?? "Máquina"), type: String(row.assembly_line ?? "—"), status: String(row.status ?? "—"), target: row.coolant_temperature_c === null || row.coolant_temperature_c === undefined ? "Ausente" : `${Number(row.coolant_temperature_c).toLocaleString("pt-BR", {maximumFractionDigits: 2})} °C`, limit: row.spindle_vibration_um === null || row.spindle_vibration_um === undefined ? "Ausente" : `${Number(row.spindle_vibration_um).toLocaleString("pt-BR", {maximumFractionDigits: 3})} µm`, reviewer: new Date(String(row.date)).toLocaleString("pt-BR", {timeZone:"UTC"}),
  } : { id: index + 1, header: String(row.grupo ?? index + 1), type: String(row.leituras ?? ""), status: "Calculado", target: String(row.media ?? "Ausente"), limit: String(row.maxima ?? "Ausente"), reviewer: String(result.args.metric ?? "") })
  return <div className="min-w-0 space-y-3 rounded-xl border bg-background py-4"><div className="px-6"><h4 className="text-sm font-semibold">{props.title}</h4><p className="mt-1 text-xs text-muted-foreground">{result.data.description}</p></div><div className="max-h-[560px] overflow-auto"><DataTable data={rows} labels={readings ? {header:"Máquina",type:"Linha",status:"Condição",target:"Temp. refrig. °C",limit:"Vib. spindle µm",reviewer:"Data"} : {header:"Grupo",type:"Leituras",status:"Status",target:"Média",limit:"Máxima",reviewer:"Métrica"}}/></div></div>
} })
const ChartResult = defineComponent({ ...ChartResultSpec, component: ({ props }) => {
  const result = useResult(props.resultId)
  if (!result?.data.series?.length) return <p className="text-sm text-muted-foreground">Esta consulta não retornou uma série diária. Solicite um agrupamento por dia.</p>
  return <ChartAreaInteractive data={result.data.series} title={props.title} description={result.data.description ?? "Média e máxima diária"} labels={{desktop:"Média",mobile:"Máxima"}} stacked={false}/>
} })
const FollowUp = defineComponent({ ...FollowUpSpec, component: ({ props }) => {
  const context = React.useContext(ResultContext)
  return <Button variant="outline" disabled={context.busy} onClick={() => context.onAsk(props.question)} className="w-fit whitespace-normal text-left">{props.label}</Button>
} })
const Analysis = defineComponent({ ...AnalysisSpec, component: ({ props, renderNode }) => <section className="min-w-0 space-y-4"><h3 className="text-lg font-semibold tracking-tight">{props.title}</h3><MarkdownMessage content={props.summary}/><div className="flex min-w-0 flex-col gap-4">{renderNode(props.blocks)}</div></section> })
export function ChangeReviewCard({change}:{change:NonNullable<ToolResult["data"]["change"]>}) {
  const entry=useCommandStore(state=>state.entries[change.id]),hydrate=useCommandStore(state=>state.hydrate),confirm=useCommandStore(state=>state.confirmChange)
  const status=entry?.status??change.status,saving=entry?.pending??false,error=entry?.error
  React.useEffect(()=>{if(entry?.traceparent)recordComponentRender(entry.traceparent,"telemetry.apply-change")},[entry?.traceparent])
  React.useEffect(()=>{let active=true;fetch(`/api/changes/${change.id}`).then(res=>res.json()).then(data=>{if(active&&data.status)hydrate(change.id,data.status)}).catch(()=>{});return()=>{active=false}},[change.id,hydrate])
  return <Card className="border-amber-200"><CardHeader className="space-y-3"><CardTitle>Revisar alteração · leitura #{change.readingId}</CardTitle><CardDescription>Campo: {change.field}. A alteração será registrada no banco com os valores antes e depois.</CardDescription><ChangeValues before={change.before} after={change.after} optimistic={saving}/><Button disabled={saving||status!=="pending"} onClick={()=>void confirm(change.id,change.after)} className="w-fit">{saving?"Salvando…":status==="applied"?"Alteração salva":"Confirmar e salvar alteração"}</Button>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</CardHeader></Card>
}
const ChangeReview=defineComponent({...ChangeReviewSpec,component:({props})=>{const change=useResult(props.resultId)?.data.change;return change?<ChangeReviewCard change={change}/>:null}})
const ImportReview=defineComponent({...ImportReviewSpec,component:({props})=>{const preview=useResult(props.resultId)?.data.importPreview,context=React.useContext(ResultContext);return preview?<ImportReviewCard preview={preview} disabled={context.busy}/>:null}})
const library = createLibrary({ root: "Analysis", components: [Analysis, Metric, DataResult, ChartResult, FollowUp,ChangeReview,ImportReview] })

export function AnalysisMessage({ content, results, onAsk, busy,isStreaming=false }: { content: string; results: ToolResult[]; onAsk: (question:string)=>void; busy: boolean;isStreaming?:boolean }) {
  const [failed, setFailed] = React.useState(false)
  const onError = React.useCallback((errors: OpenUIError[]) => { if (!isStreaming&&errors.some((error) => error.severity !== "warning")) setFailed(true) }, [isStreaming])
  return <ResultContext.Provider value={{results, onAsk, busy}}>{failed ? <p className="text-sm text-muted-foreground">Não foi possível renderizar esta análise. Consulte os resultados das funções ou peça uma nova análise.</p> : <Renderer response={content} library={library} isStreaming={isStreaming} onError={onError} publishObservability={false}/>}</ResultContext.Provider>
}
