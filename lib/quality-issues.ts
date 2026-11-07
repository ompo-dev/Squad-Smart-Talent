import {qualityIssueLabels, type QualityIssue} from "@/lib/telemetry-schema"
import type {TelemetryRow} from "@/lib/types"

/**
 * Investigação dos problemas de qualidade já gravados em `quality_issues`.
 * Não reaplica regra de limpeza: apenas lê, agrupa e exporta o que o sistema registrou.
 */

const categoryByReason = new Map<string, QualityIssue>(
  (Object.entries(qualityIssueLabels) as [QualityIssue, string][]).map(([issue, reason]) => [reason, issue]),
)

export const qualityCategories = (Object.keys(qualityIssueLabels) as QualityIssue[])
  .map(value => ({value, label: qualityIssueLabels[value]}))

export type QualityOccurrence = {
  readingId: number
  recordKey: string
  machineId: string
  assemblyLine: string
  timestamp: string
  sensor: string
  reason: string
  category: QualityIssue | null
}

export function parseQualityIssue(issue: string): {sensor: string; reason: string; category: QualityIssue | null} {
  const separator = issue.indexOf(": ")
  const sensor = separator === -1 ? "Leitura" : issue.slice(0, separator)
  const reason = separator === -1 ? issue : issue.slice(separator + 2)
  return {sensor, reason, category: categoryByReason.get(reason) ?? null}
}

export function qualityOccurrences(rows: TelemetryRow[]): QualityOccurrence[] {
  return rows.flatMap(row => row.qualityIssues.map(issue => {
    const parsed = parseQualityIssue(issue)
    return {
      readingId: row.id,
      recordKey: row.recordKey,
      machineId: row.machineId,
      assemblyLine: row.assemblyLine,
      timestamp: row.timestamp,
      ...parsed,
    }
  }))
}

/** Uma leitura pode ter vários problemas: conta leituras afetadas e ocorrências separadamente. */
export function summarizeQuality(occurrences: QualityOccurrence[]) {
  return {
    readings: new Set(occurrences.map(occurrence => occurrence.readingId)).size,
    occurrences: occurrences.length,
  }
}

export function matchesQuality(row: TelemetryRow, category: QualityIssue | "all") {
  if (category === "all") return true
  return row.qualityIssues.some(issue => parseQualityIssue(issue).category === category)
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** CSV de todas as ocorrências das leituras recebidas, independente de paginação. */
export function qualityCsv(rows: TelemetryRow[]) {
  const header = ["leitura_id", "record_key", "maquina", "linha", "data", "sensor", "motivo", "categoria"]
  const lines = qualityOccurrences(rows).map(occurrence => [
    occurrence.readingId,
    occurrence.recordKey,
    occurrence.machineId,
    occurrence.assemblyLine,
    occurrence.timestamp,
    occurrence.sensor,
    occurrence.reason,
    occurrence.category ? qualityIssueLabels[occurrence.category] : occurrence.reason,
  ])
  return [header, ...lines].map(line => line.map(csvCell).join(";")).join("\r\n")
}
