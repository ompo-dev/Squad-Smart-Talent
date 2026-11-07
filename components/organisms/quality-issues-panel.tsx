"use client"
import { useEffect, useMemo, useState } from "react"
import { Download, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { qualityCategories, qualityOccurrenceCsv, qualityOccurrences, summarizeQuality, type QualityOccurrence } from "@/lib/quality-issues"
import { qualityIssueLabels, type QualityIssue } from "@/lib/telemetry-schema"
import type {TelemetryRow} from "@/lib/types"

const date = new Intl.DateTimeFormat("pt-BR", {dateStyle: "short", timeStyle: "short", timeZone: "UTC"})

const qualityLabels = {header: "Máquina", type: "Linha", status: "Categoria", target: "Sensor", limit: "Motivo", reviewer: "Data"}
const qualityExtraColumns = [{key: "recordKey", label: "Record key"}]

function categorize(occurrence: QualityOccurrence) {
  return occurrence.category ? qualityIssueLabels[occurrence.category] : occurrence.reason
}

export function QualityIssuesPanel({rows, filter, loading}: {
  rows: TelemetryRow[]; filter: QualityIssue | "all"; loading?: boolean
}) {
  const allOccurrences = useMemo(() => qualityOccurrences(rows), [rows])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<QualityIssue | "all">(filter)
  useEffect(() => setCategory(filter), [filter])
  const occurrences = useMemo(() => allOccurrences.filter((occurrence) => {
    const text = `${occurrence.machineId} ${occurrence.assemblyLine} ${occurrence.sensor} ${occurrence.reason} ${occurrence.recordKey}`.toLowerCase()
    const matchesSearch = text.includes(search.trim().toLowerCase())
    const matchesCategory = category === "all" || occurrence.category === category
    return matchesSearch && matchesCategory
  }), [allOccurrences, category, search])
  const summary = useMemo(() => summarizeQuality(occurrences), [occurrences])
  const activeCategory = category === "all" ? null : qualityIssueLabels[category]
  const activeFilters = Boolean(search || category !== "all")
  const tableRows = useMemo(() => occurrences.map((occurrence, index) => ({
    id: index,
    header: occurrence.machineId,
    type: occurrence.assemblyLine,
    status: categorize(occurrence),
    target: occurrence.sensor,
    limit: occurrence.reason,
    reviewer: date.format(new Date(occurrence.timestamp)),
    recordKey: occurrence.recordKey,
  })), [occurrences])

  function exportCsv() {
    const blob = new Blob(["\ufeff" + qualityOccurrenceCsv(occurrences)], {type: "text/csv;charset=utf-8"})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = category === "all" ? "qualidade-leituras.csv" : `qualidade-leituras-${category}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <section className="rounded-xl border bg-card shadow-xs" aria-label="Problemas de qualidade">
    <div className="flex flex-col gap-3 border-b px-4 py-4 lg:flex-row lg:items-center lg:px-6">
      <div className="min-w-0">
        <h2 className="text-base font-medium">Problemas de qualidade</h2>
        <p className="text-xs leading-5 text-muted-foreground" role="status">
          {loading
            ? "Carregando leituras…"
            : summary.occurrences
              ? `${summary.readings.toLocaleString("pt-BR")} leituras afetadas · ${summary.occurrences.toLocaleString("pt-BR")} ocorrências${activeCategory ? ` · ${activeCategory}` : ""}`
              : activeFilters
                ? "Nenhuma ocorrência com os filtros atuais."
                : "Nenhum problema de qualidade nas leituras filtradas."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={exportCsv} disabled={!summary.occurrences} className="gap-1 lg:ml-auto">
        <Download className="size-3.5"/>Exportar CSV
      </Button>
    </div>
    <div className="flex flex-col gap-3 px-4 pt-4 lg:flex-row lg:items-center lg:px-6">
      <div className="relative w-full lg:max-w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar máquina, linha, sensor, motivo ou record key…" aria-label="Buscar problema de qualidade" className="h-9 pl-9 pr-9"/>
        {search && <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca"><X className="size-4"/></button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={(value) => value && setCategory(value as QualityIssue | "all")}>
          <SelectTrigger size="sm" className="w-[230px]" aria-label="Filtrar por categoria de qualidade"><SelectValue>{category === "all" ? "Todas as categorias" : qualityIssueLabels[category]}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {qualityCategories.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategory("all") }} disabled={!activeFilters} className="gap-1"><X className="size-3.5"/>Limpar</Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground lg:ml-auto">
        <span className="rounded-full bg-muted px-2.5 py-1 tabular-nums">{occurrences.length.toLocaleString("pt-BR")} de {allOccurrences.length.toLocaleString("pt-BR")} ocorrências</span>
        {activeFilters && <span>filtros ativos</span>}
      </div>
    </div>
    {summary.occurrences > 0 && <div className="pb-2">
      <DataTable data={tableRows} labels={qualityLabels} extraColumns={qualityExtraColumns} showViews={false} showSections={false}/>
    </div>}
  </section>
}
