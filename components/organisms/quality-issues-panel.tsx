"use client"
import { useMemo } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { qualityCsv, qualityOccurrences, summarizeQuality, type QualityOccurrence } from "@/lib/quality-issues"
import { qualityIssueLabels, type QualityIssue } from "@/lib/telemetry-schema"
import type {TelemetryRow} from "@/lib/types"

const date = new Intl.DateTimeFormat("pt-BR", {dateStyle: "short", timeStyle: "short", timeZone: "UTC"})

function categorize(occurrence: QualityOccurrence) {
  return occurrence.category ? qualityIssueLabels[occurrence.category] : occurrence.reason
}

export function QualityIssuesPanel({rows, filter, loading}: {
  rows: TelemetryRow[]; filter: QualityIssue | "all"; loading?: boolean
}) {
  const occurrences = useMemo(() => qualityOccurrences(rows), [rows])
  const summary = useMemo(() => summarizeQuality(occurrences), [occurrences])
  const activeCategory = filter === "all" ? null : qualityIssueLabels[filter]

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
    {summary.occurrences > 0 && <div className="max-h-80 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Máquina</TableHead>
            <TableHead>Linha</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Sensor</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Categoria</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {occurrences.map((occurrence, index) => <TableRow key={`${occurrence.recordKey}-${index}`}>
            <TableCell className="font-medium whitespace-nowrap">{occurrence.machineId}</TableCell>
            <TableCell className="whitespace-nowrap">{occurrence.assemblyLine}</TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">{date.format(new Date(occurrence.timestamp))}</TableCell>
            <TableCell className="whitespace-nowrap">{occurrence.sensor}</TableCell>
            <TableCell>{occurrence.reason}</TableCell>
            <TableCell className="whitespace-nowrap">{categorize(occurrence)}</TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </div>}
  </section>
}
