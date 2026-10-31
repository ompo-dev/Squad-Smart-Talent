"use client"
import { useEffect,useMemo, useState } from "react"
import {useTelemetryStore} from "@/lib/stores/telemetry-store"
import {recordComponentRender} from "@/lib/observability/client"
import {useRealtimeStore} from "@/lib/stores/realtime-store"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardHeader, CardDescription, CardTitle, CardFooter } from "@/components/ui/card"
import { Search, X } from "lucide-react"
import type {TelemetryRow} from "@/lib/types"
import {telemetryDisplayRow,telemetryExtraColumns,telemetryLabels} from "@/lib/telemetry-display"

export function StandardTelemetryView({ rows:initialRows, series:initialSeries, stats:initialStats,mode="readings" }: {
  mode?:"latest"|"alerts"|"readings"
  rows: TelemetryRow[]; series: { date: string; desktop: number; mobile: number }[]
  stats?: { readings: number; machines: number; temperature: number | null; alerts: number }
}) {
  const view=useTelemetryStore(state=>state.views[mode]),load=useTelemetryStore(state=>state.load),loading=useTelemetryStore(state=>state.loading[mode]),error=useTelemetryStore(state=>state.errors[mode]),parent=useTelemetryStore(state=>state.traceparent)
  const rows=view?.rows??initialRows,series=view?.series??initialSeries,stats=view?.stats??initialStats
  useEffect(()=>{if(parent)recordComponentRender(parent,"telemetry.read")},[parent])
  useEffect(()=>{const parent=useRealtimeStore.getState().traceparent;if(parent)recordComponentRender(parent,"telemetry.read")},[initialRows])
  const [search, setSearch] = useState("")
  const [condition, setCondition] = useState("all")
  const [downtimeFilter, setDowntimeFilter] = useState("all")
  const filtered = useMemo(() => rows.filter((row) => {
    const text=`${row.machineId} ${row.assemblyLine} ${row.recordKey}`.toLowerCase()
    const matchesSearch=text.includes(search.toLowerCase())
    const matchesCondition=condition==="all"||row.status===condition
    const matchesDowntime=downtimeFilter==="all"||(downtimeFilter==="yes"&&row.downtime===true)||(downtimeFilter==="no"&&row.downtime===false)||(downtimeFilter==="unknown"&&row.downtime===null)
    return matchesSearch&&matchesCondition&&matchesDowntime
  }), [rows, search, condition, downtimeFilter])
  const tableRows = useMemo(()=>filtered.map(telemetryDisplayRow), [filtered])
  const activeFilters = Boolean(search || condition !== "all" || downtimeFilter !== "all")
  function clearFilters() {
    setSearch("")
    setCondition("all")
    setDowntimeFilter("all")
  }
  return <div className="@container/main flex min-w-0 flex-col gap-6">
    <div className="flex items-center justify-end gap-3">{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button variant="outline" disabled={loading} onClick={()=>void load(mode)}>{loading?"Atualizando…":"Atualizar leituras"}</Button></div>
    {stats && <div className="grid gap-4 sm:grid-cols-2 @5xl/main:grid-cols-4">{[
      ["Máquinas monitoradas", String(stats.machines), "Ativos presentes na base de manutenção"],
      ["Temp. do refrigerante", stats.temperature === null ? "Ausente" : `${stats.temperature} °C`, "Média das leituras válidas"],
      ["Leituras em alerta", String(stats.alerts), "Parada registrada ou sensor em faixa crítica"],
      ["Leituras disponíveis", stats.readings.toLocaleString("pt-BR"), "Todas as leituras no PostgreSQL"],
    ].map(([label, value, note]) => <Card key={label} className="@container/card"><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle></CardHeader><CardFooter className="items-start text-xs leading-5 text-muted-foreground">{note}</CardFooter></Card>)}</div>}
    <ChartAreaInteractive data={series} title="Temperatura do refrigerante" description="Média e máxima diária · °C · todo o período disponível" labels={{ desktop: "Média °C", mobile: "Máxima °C" }} stacked={false}/>
    <div className="rounded-xl border bg-card py-6 shadow-xs">
      <div className="mb-5 px-4 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar máquina, linha ou record key…" aria-label="Buscar leitura" className="h-9 pl-9 pr-9"/>
            {search && <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca"><X className="size-4"/></button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={condition} onValueChange={(value) => value && setCondition(value)}>
              <SelectTrigger size="sm" className="w-[190px]" aria-label="Filtrar por condição"><SelectValue>{condition === "all" ? "Todas as condições" : condition}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as condições</SelectItem>
                <SelectItem value="Falha">Falha</SelectItem>
                <SelectItem value="Crítico">Crítico</SelectItem>
                <SelectItem value="Atenção">Atenção</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={downtimeFilter} onValueChange={(value) => value && setDowntimeFilter(value)}>
              <SelectTrigger size="sm" className="w-[175px]" aria-label="Filtrar por parada"><SelectValue>{downtimeFilter === "all" ? "Todas as paradas" : downtimeFilter === "yes" ? "Com parada" : downtimeFilter === "no" ? "Sem parada" : "Sem rótulo"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as paradas</SelectItem>
                <SelectItem value="yes">Com parada</SelectItem>
                <SelectItem value="no">Sem parada</SelectItem>
                <SelectItem value="unknown">Sem rótulo</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={clearFilters} disabled={!activeFilters} className="gap-1"><X className="size-3.5"/>Limpar</Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground lg:ml-auto">
            <span className="rounded-full bg-muted px-2.5 py-1 tabular-nums">{filtered.length.toLocaleString("pt-BR")} de {rows.length.toLocaleString("pt-BR")} registros</span>
            {activeFilters && <span>filtros ativos</span>}
          </div>
        </div>
      </div>
      <DataTable data={tableRows} labels={telemetryLabels} extraColumns={telemetryExtraColumns} showViews={false} showSections={false}/>
    </div>
  </div>
}
