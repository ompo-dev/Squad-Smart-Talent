import {parse} from "csv-parse/sync"
import {executeCommand,payloadHash} from "@/lib/application/command-bus"
import type {Prisma} from "@/generated/prisma/client"
import {
  canonicalHeader,
  fieldForHeader,
  parseDowntimeLabel,
  parseSensorNumber,
  parseTelemetryDate,
  requiredFields,
  sensorDefinitions,
  type QualityIssue,
  type SensorKey,
  type TelemetryField,
} from "@/lib/telemetry-schema"
import {telemetryRecordKey} from "@/lib/telemetry-record-key"

export type TelemetryQualitySummary = {
  missingCells: number
  zeroCells: number
  negativeCells: number
  outOfRangeCells: number
  outlierCells: number
  missingLabels: number
  repairedCells: number
  repairedRows: number
  rowsWithoutSensors: number
}

export type ParsedTelemetryReading = {
  recordKey: string
  machineId: string
  assemblyLine: string
  timestamp: Date
  downtime: boolean | null
  downtimeLabel: string | null
  qualityIssues: string[]
} & Record<SensorKey, number | null>

const issueLabel: Partial<Record<QualityIssue, string>> = {
  missing: "ausente", sentinel: "sentinela", zero: "zero tratado como ausente",
  negative: "negativo tratado como ausente", outOfRange: "fora da faixa física",
  outlier: "outlier estatístico", missingLabel: "rótulo de parada ausente",
  noSensors: "sem sensores", invalid: "inválido",
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function headerMap(rows: Record<string, unknown>[]) {
  const map = new Map<TelemetryField, string>()
  for (const header of Object.keys(rows[0] ?? {})) {
    const field = fieldForHeader(header)
    if (!field) continue
    if (map.has(field)) throw new Error(`Duas colunas representam ${canonicalHeader[field]}. Mantenha apenas uma antes de importar.`)
    map.set(field, header)
  }
  const missing = requiredFields.filter(field => !map.has(field))
  if (missing.length) throw new Error(`Colunas de telemetria ausentes: ${missing.map(field => canonicalHeader[field]).join(", ")}`)
  return map
}

function quantile(sorted: number[], position: number) {
  const index = (sorted.length - 1) * position
  const lower = Math.floor(index)
  const fraction = index - lower
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction
}

function flagOutliers(readings: ParsedTelemetryReading[], quality: TelemetryQualitySummary) {
  for (const definition of sensorDefinitions) {
    const values = readings.map(reading => reading[definition.key]).filter((value): value is number => value !== null).sort((a, b) => a - b)
    if (values.length < 8) continue
    const q1 = quantile(values, 0.25)
    const q3 = quantile(values, 0.75)
    const iqr = q3 - q1
    if (iqr <= 0) continue
    const low = q1 - 3 * iqr
    const high = q3 + 3 * iqr
    for (const reading of readings) {
      const value = reading[definition.key]
      if (value === null || (value >= low && value <= high)) continue
      reading.qualityIssues.push(`${definition.shortLabel}: ${issueLabel.outlier}`)
      quality.outlierCells++
    }
  }
}

/**
 * Parses and cleans a Machine Downtime CSV.
 *
 * - accepts raw dataset headers and canonical headers;
 * - parses DD-MM-YYYY as UTC midnight;
 * - converts blanks, sentinels, zero/negative values and hard out-of-range
 *   cells to null, recording a quality issue per repaired cell;
 * - flags statistical outliers without discarding the value;
 * - skips only rows without a usable date, machine or assembly line.
 */
export function parseTelemetry(csv: string) {
  if (csv.length > 5 * 1024 * 1024) throw new Error("CSV excede 5 MB")
  const rows = parse(csv, {columns: true, bom: true, skip_empty_lines: true, trim: true}) as Record<string, unknown>[]
  if (!rows.length) throw new Error("O CSV precisa conter um cabeçalho e ao menos uma leitura.")
  const fields = headerMap(rows)
  const seen = new Set<string>(), readings: ParsedTelemetryReading[] = [], errors: string[] = []
  const quality: TelemetryQualitySummary = {
    missingCells: 0, zeroCells: 0, negativeCells: 0, outOfRangeCells: 0, outlierCells: 0,
    missingLabels: 0, repairedCells: 0, repairedRows: 0, rowsWithoutSensors: 0,
  }
  let duplicates = 0, invalid = 0

  for (const [index, row] of rows.entries()) {
    const cell = (field: TelemetryField) => (fields.has(field) ? row[fields.get(field)!] : undefined)
    try {
      const timestamp = parseTelemetryDate(cell("timestamp"))
      const machineId = text(cell("machineId")).slice(0, 120)
      const assemblyLine = text(cell("assemblyLine")).slice(0, 80)
      const missing: string[] = []
      if (!timestamp) missing.push("data")
      if (!machineId) missing.push("máquina")
      if (!assemblyLine) missing.push("linha de montagem")
      if (missing.length) throw new Error(`Campos obrigatórios inválidos: ${missing.join(", ")}`)

      const rowIssues: string[] = []
      const values = {} as Record<SensorKey, number | null>
      let sensorCount = 0
      for (const definition of sensorDefinitions) {
        const parsed = parseSensorNumber(cell(definition.key), definition)
        values[definition.key] = parsed.value
        if (parsed.value !== null) sensorCount++
        if (!parsed.issue) continue
        if (parsed.issue === "missing") quality.missingCells++
        else if (parsed.issue === "zero") quality.zeroCells++
        else if (parsed.issue === "negative") quality.negativeCells++
        else if (parsed.issue === "outOfRange") quality.outOfRangeCells++
        else if (parsed.issue === "sentinel") quality.missingCells++
        quality.repairedCells++
        rowIssues.push(`${definition.shortLabel}: ${issueLabel[parsed.issue] ?? parsed.issue}`)
      }

      const parsedLabel = parseDowntimeLabel(cell("downtime"))
      if (parsedLabel.issue === "missingLabel") {
        quality.missingLabels++
        rowIssues.push(`Parada: ${issueLabel.missingLabel}`)
      }
      if (!sensorCount) {
        quality.rowsWithoutSensors++
        rowIssues.push(issueLabel.noSensors ?? "sem sensores")
      }

      const cleaned = {
        machineId, assemblyLine, timestamp: timestamp!, downtime: parsedLabel.downtime, downtimeLabel: parsedLabel.label,
        ...values,
        qualityIssues: rowIssues,
      }
      const recordKey = telemetryRecordKey(cleaned)
      if (seen.has(recordKey)) { duplicates++; continue }
      seen.add(recordKey)
      if (rowIssues.length) quality.repairedRows++
      readings.push({...cleaned, recordKey})
    } catch (error) {
      invalid++
      if (errors.length < 5) errors.push(`Linha ${index + 2}: ${error instanceof Error ? error.message : "inválida"}`)
    }
  }

  flagOutliers(readings, quality)
  if (!readings.length) throw new Error("Nenhuma leitura válida no arquivo")
  readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.machineId.localeCompare(b.machineId) || a.recordKey.localeCompare(b.recordKey))
  return {readings, received: rows.length, valid: readings.length, duplicates, invalid, errors, quality}
}

export async function importTelemetry(csv: string, key?: string) {
  const {readings, received, duplicates, invalid, errors, quality} = parseTelemetry(csv)
  return executeCommand({type: "telemetry.import-csv", idempotencyKey: key ?? payloadHash(csv), payload: {hash: payloadHash(csv)}}, async tx => {
    let inserted = 0
    for (let offset = 0; offset < readings.length; offset += 500) {
      const batch = readings.slice(offset, offset + 500) as Prisma.TelemetryCreateManyInput[]
      inserted += (await tx.telemetry.createMany({data: batch, skipDuplicates: true})).count
    }
    return {received, valid: readings.length, inserted, existing: readings.length - inserted, duplicates, invalid, errors, quality}
  })
}
