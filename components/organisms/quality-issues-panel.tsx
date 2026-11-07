"use client"
import { useMemo } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { qualityCsv, qualityOccurrences, summarizeQuality, type QualityOccurrence } from "@/lib/quality-issues"
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
  const occurrences = useMemo(() => qualityOccurrences(rows), [rows])
  const summary = useMemo(() => summarizeQuality(occurrences), [occurrences])
  const activeCategory = filter === "all" ? null : qualityIssueLabels[filter]
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
    const blob = new Blob(["\ufeff" + qualityCsv(rows)], {type: "text/csv;charset=utf-8"})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filter === "all" ? "qualidade-leituras.csv" : `qualidade-leituras-${filter}.csv`
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
              : activeCategory
                ? `Nenhuma leitura com ${activeCategory.toLowerCase()} nas leituras filtradas.`
                : "Nenhum problema de qualidade nas leituras filtradas."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={exportCsv} disabled={!summary.occurrences} className="gap-1 lg:ml-auto">
        <Download className="size-3.5"/>Exportar CSV
      </Button>
    </div>
    {summary.occurrences > 0 && <div className="pb-2">
      <DataTable data={tableRows} labels={qualityLabels} extraColumns={qualityExtraColumns} showViews={false} showSections={false}/>
    </div>}
  </section>
}
