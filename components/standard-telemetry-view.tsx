"use client"
import { useEffect,useMemo, useState } from "react"
import {useTelemetryStore} from "@/lib/stores/telemetry-store"
import {recordComponentRender} from "@/lib/observability/client"
import {useRealtimeStore} from "@/lib/stores/realtime-store"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardDescription, CardTitle, CardFooter } from "@/components/ui/card"

type RecordRow = { id: number; header: string; type: string; status: string; target: string; limit: string; reviewer: string }
export function StandardTelemetryView({ rows:initialRows, series:initialSeries, stats:initialStats,mode="latest" }: {
  mode?:"latest"|"alerts"|"readings"
  rows: RecordRow[]; series: { date: string; desktop: number; mobile: number }[]
  stats?: { readings: number; machines: number; temperature: number | null; alerts: number }
}) {
  const view=useTelemetryStore(state=>state.views[mode]),load=useTelemetryStore(state=>state.load),loading=useTelemetryStore(state=>state.loading[mode]),error=useTelemetryStore(state=>state.errors[mode]),parent=useTelemetryStore(state=>state.traceparent)
  const rows=view?.rows??initialRows,series=view?.series??initialSeries,stats=view?.stats??initialStats
  useEffect(()=>{if(parent)recordComponentRender(parent,"telemetry.read")},[parent])
  useEffect(()=>{const parent=useRealtimeStore.getState().traceparent;if(parent)recordComponentRender(parent,"telemetry.read")},[initialRows])
  const [search, setSearch] = useState("")
  const [condition, setCondition] = useState("all")
  const filtered = useMemo(() => rows.filter((r) => r.header.toLowerCase().includes(search.toLowerCase()) && (condition === "all" || r.status === condition)), [rows, search, condition])
  return <div className="@container/main flex min-w-0 flex-col gap-6">
    <div className="flex items-center justify-end gap-3">{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button variant="outline" disabled={loading} onClick={()=>void load(mode)}>{loading?"Atualizando…":"Atualizar leituras"}</Button></div>
    {stats && <div className="grid gap-4 sm:grid-cols-2 @5xl/main:grid-cols-4">{[
      ["Máquinas monitoradas", String(stats.machines), "Ativos presentes na base de telemetria"],
      ["Temp. do refrigerante", stats.temperature === null ? "Ausente" : `${stats.temperature} °C`, "Média das leituras válidas"],
      ["Leituras em alerta", String(stats.alerts), "Parada registrada ou sensor em faixa crítica"],
      ["Leituras disponíveis", stats.readings.toLocaleString("pt-BR"), "Base de telemetria no PostgreSQL"],
    ].map(([label, value, note]) => <Card key={label} className="@container/card"><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle></CardHeader><CardFooter className="items-start text-xs leading-5 text-muted-foreground">{note}</CardFooter></Card>)}</div>}
    <ChartAreaInteractive data={series} title="Temperatura do refrigerante" description="Média e máxima diária · °C" labels={{ desktop: "Média °C", mobile: "Máxima °C" }} stacked={false}/>
    <div className="rounded-xl border bg-card py-6 shadow-xs">
      <div className="mb-5 flex flex-wrap items-center gap-3 px-4 lg:px-6"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar máquina…" aria-label="Buscar máquina" className="max-w-64"/><div className="flex flex-wrap gap-1">{["all", "Normal", "Atenção", "Crítico", "Falha"].map((value) => <Button key={value} variant={condition === value ? "secondary" : "ghost"} size="sm" onClick={() => setCondition(value)}>{value === "all" ? "Todas" : value}</Button>)}</div><span className="ml-auto text-xs text-muted-foreground">{filtered.length} registros</span></div>
      <DataTable data={filtered} labels={{ header: "Máquina", type: "Linha", status: "Condição", target: "Temp. refrig. °C", limit: "Vib. spindle µm", reviewer: "Data da leitura" }}/>
    </div>
  </div>
}
