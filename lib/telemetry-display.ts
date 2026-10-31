import {sensorDefinitions} from "@/lib/telemetry-schema"
import type {TelemetryRow} from "@/lib/types"

export type TelemetryDisplayRow = {
  id: number
  header: string
  type: string
  status: string
  target: string
  limit: string
  reviewer: string
  hydraulicPressure?: number | null
  coolantPressure?: number | null
  airSystemPressure?: number | null
  hydraulicOilTemperature?: number | null
  spindleBearingTemperature?: number | null
  toolVibration?: number | null
  spindleSpeed?: number | null
  voltage?: number | null
  torque?: number | null
  cutting?: number | null
  downtime?: string
  downtimeLabel?: string
  quality?: string
  version?: number
  recordKey?: string
}

const decimal = new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 3})
const date = new Intl.DateTimeFormat("pt-BR", {dateStyle: "short", timeZone: "UTC"})

function format(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return unit ? `${decimal.format(value)} ${unit}` : decimal.format(value)
}

const definitions = Object.fromEntries(sensorDefinitions.map(definition => [definition.key, definition]))

const extraSensorKeys = [
  "hydraulicPressure", "coolantPressure", "airSystemPressure", "hydraulicOilTemperature",
  "spindleBearingTemperature", "toolVibration", "spindleSpeed", "voltage", "torque", "cutting",
] as const

export const telemetryLabels = {
  header: "Máquina",
  type: "Linha",
  status: "Condição",
  target: "Temp. refrig. °C",
  limit: "Vib. spindle µm",
  reviewer: "Data da leitura",
}

export const telemetryExtraColumns = [
  ...extraSensorKeys.map(key => {
    const definition = definitions[key]
    return {key, label: `${definition.shortLabel} (${definition.unit})`, format: (value: unknown) => format(value as number | null, definition.unit)}
  }),
  {key: "downtime", label: "Parada"},
  {key: "downtimeLabel", label: "Rótulo de parada"},
  {key: "quality", label: "Qualidade"},
  {key: "version", label: "Versão"},
  {key: "recordKey", label: "Record key"},
]

export function telemetryDisplayRow(row: TelemetryRow): TelemetryDisplayRow {
  return {
    id: row.id,
    header: row.machineId,
    type: row.assemblyLine,
    status: row.status,
    target: format(row.coolantTemperature, "°C"),
    limit: format(row.spindleVibration, "µm"),
    reviewer: date.format(new Date(row.timestamp)),
    hydraulicPressure: row.hydraulicPressure,
    coolantPressure: row.coolantPressure,
    airSystemPressure: row.airSystemPressure,
    hydraulicOilTemperature: row.hydraulicOilTemperature,
    spindleBearingTemperature: row.spindleBearingTemperature,
    toolVibration: row.toolVibration,
    spindleSpeed: row.spindleSpeed,
    voltage: row.voltage,
    torque: row.torque,
    cutting: row.cutting,
    downtime: row.downtime === null ? "—" : row.downtime ? "Sim" : "Não",
    downtimeLabel: row.downtimeLabel ?? "—",
    quality: row.qualityIssues.length ? `${row.qualityIssues.length} aviso(s)` : "OK",
    version: row.version,
    recordKey: row.recordKey,
  }
}
