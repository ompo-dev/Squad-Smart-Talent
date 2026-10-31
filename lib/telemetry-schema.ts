/**
 * Canonical schema and cleaning rules for the Machine Downtime dataset.
 *
 * The dataset is intentionally dirty: it mixes decimal separators, uses
 * zero/negative sentinels for missing readings and contains extreme values.
 * Everything that touches telemetry (import, preview, dashboard, agent, API)
 * must use these definitions so cleaning is deterministic and auditable.
 */

export type SensorKey =
  | "hydraulicPressure"
  | "coolantPressure"
  | "airSystemPressure"
  | "coolantTemperature"
  | "hydraulicOilTemperature"
  | "spindleBearingTemperature"
  | "spindleVibration"
  | "toolVibration"
  | "spindleSpeed"
  | "voltage"
  | "torque"
  | "cutting"

export type TelemetryField = "timestamp" | "machineId" | "assemblyLine" | SensorKey | "downtime"

export type QualityIssue = "missing" | "sentinel" | "zero" | "negative" | "outOfRange" | "outlier" | "missingLabel" | "noSensors" | "invalid"

export type Thresholds = { warnLow?: number; warnHigh?: number; critLow?: number; critHigh?: number }

export type SensorDefinition = {
  key: SensorKey
  /** Canonical column written to the normalized CSV and to PostgreSQL. */
  column: string
  /** Prisma model field. */
  field: SensorKey
  label: string
  shortLabel: string
  unit: string
  aliases: readonly string[]
  /** Hard physical limits. Values outside are treated as missing. */
  min: number
  max: number
  /** Zero has no physical meaning for these sensors and is treated as missing. */
  positive: boolean
  thresholds?: Thresholds
}

export const sensorDefinitions: readonly SensorDefinition[] = [
  {
    key: "hydraulicPressure", column: "hydraulic_pressure_bar", field: "hydraulicPressure",
    label: "Pressão hidráulica", shortLabel: "Pressão hidr.", unit: "bar",
    aliases: ["hydraulic_pressure_bar", "hydraulic_pressure", "hydraulicpressurebar", "hydraulicpressure", "pressao_hidraulica", "pressão hidráulica"],
    min: 0, max: 300, positive: true,
    thresholds: { warnLow: 55, warnHigh: 165, critLow: 40, critHigh: 185 },
  },
  {
    key: "coolantPressure", column: "coolant_pressure_bar", field: "coolantPressure",
    label: "Pressão do refrigerante", shortLabel: "Pressão refr.", unit: "bar",
    aliases: ["coolant_pressure_bar", "coolant_pressure", "coolantpressurebar", "coolantpressure", "pressao_refrigerante", "pressão do refrigerante"],
    min: 0, max: 20, positive: true,
    thresholds: { warnLow: 3, warnHigh: 7, critLow: 2, critHigh: 9 },
  },
  {
    key: "airSystemPressure", column: "air_system_pressure_bar", field: "airSystemPressure",
    label: "Pressão do ar", shortLabel: "Pressão ar", unit: "bar",
    aliases: ["air_system_pressure_bar", "air_system_pressure", "airsystempressurebar", "airsystempressure", "pressao_ar", "pressão do ar"],
    min: 0, max: 20, positive: true,
    thresholds: { warnLow: 5.5, warnHigh: 7.5, critLow: 4, critHigh: 8 },
  },
  {
    key: "coolantTemperature", column: "coolant_temperature_c", field: "coolantTemperature",
    label: "Temperatura do refrigerante", shortLabel: "Temp. refr.", unit: "°C",
    aliases: ["coolant_temperature", "coolant_temperature_c", "coolanttemperature", "coolanttemperaturec", "temperatura_refrigerante", "temperatura do refrigerante"],
    min: 0, max: 100, positive: true,
    thresholds: { warnHigh: 32, critHigh: 45 },
  },
  {
    key: "hydraulicOilTemperature", column: "hydraulic_oil_temperature_c", field: "hydraulicOilTemperature",
    label: "Temperatura do óleo hidráulico", shortLabel: "Temp. óleo", unit: "°C",
    aliases: ["hydraulic_oil_temperature", "hydraulic_oil_temperature_c", "hydraulicoiltemperature", "hydraulicoiltemperaturec", "temperatura_oleo_hidraulico", "temperatura do óleo hidráulico"],
    min: 0, max: 120, positive: true,
    thresholds: { warnHigh: 56, critHigh: 60 },
  },
  {
    key: "spindleBearingTemperature", column: "spindle_bearing_temperature_c", field: "spindleBearingTemperature",
    label: "Temperatura do mancal do spindle", shortLabel: "Temp. mancal", unit: "°C",
    aliases: ["spindle_bearing_temperature", "spindle_bearing_temperature_c", "spindlebearingtemperature", "spindlebearingtemperaturec", "temperatura_mancal", "temperatura do mancal"],
    min: 0, max: 120, positive: true,
    thresholds: { warnHigh: 43, critHigh: 47 },
  },
  {
    key: "spindleVibration", column: "spindle_vibration_um", field: "spindleVibration",
    label: "Vibração do spindle", shortLabel: "Vib. spindle", unit: "µm",
    aliases: ["spindle_vibration", "spindle_vibration_um", "spindlevibration", "spindlevibrationm", "spindlevibrationum", "vibracao_spindle", "vibração do spindle"],
    min: 0, max: 20, positive: true,
    thresholds: { warnHigh: 1.8, critHigh: 1.95 },
  },
  {
    key: "toolVibration", column: "tool_vibration_um", field: "toolVibration",
    label: "Vibração da ferramenta", shortLabel: "Vib. ferramenta", unit: "µm",
    aliases: ["tool_vibration", "tool_vibration_um", "toolvibration", "toolvibrationm", "toolvibrationum", "vibracao_ferramenta", "vibração da ferramenta"],
    min: 0, max: 100, positive: true,
    thresholds: { warnHigh: 40, critHigh: 44 },
  },
  {
    key: "spindleSpeed", column: "spindle_speed_rpm", field: "spindleSpeed",
    label: "Rotação do spindle", shortLabel: "Rotação", unit: "rpm",
    aliases: ["spindle_speed", "spindle_speed_rpm", "spindlespeed", "spindlespeedrpm", "rotacao", "rotação"],
    min: 0, max: 40000, positive: true,
    thresholds: { warnLow: 13000, warnHigh: 27800 },
  },
  {
    key: "voltage", column: "voltage_v", field: "voltage",
    label: "Tensão", shortLabel: "Tensão", unit: "V",
    aliases: ["voltage", "voltage_v", "voltagevolts", "volts", "tensao", "tensão"],
    min: 0, max: 600, positive: true,
    thresholds: { warnLow: 250, warnHigh: 455, critLow: 200, critHigh: 470 },
  },
  {
    key: "torque", column: "torque_nm", field: "torque",
    label: "Torque", shortLabel: "Torque", unit: "Nm",
    aliases: ["torque", "torque_nm", "torquenm"],
    min: 0, max: 200, positive: true,
    thresholds: { warnHigh: 50, critHigh: 55 },
  },
  {
    key: "cutting", column: "cutting_kn", field: "cutting",
    label: "Força de corte", shortLabel: "Corte", unit: "kN",
    aliases: ["cutting", "cutting_kn", "cuttingkn", "forca_corte", "força de corte"],
    min: 0, max: 50, positive: true,
  },
]

export const sensorByKey = Object.fromEntries(sensorDefinitions.map(definition => [definition.key, definition])) as Record<SensorKey, SensorDefinition>

export const telemetryColumns = ["date", "machine_id", "assembly_line", ...sensorDefinitions.map(definition => definition.column), "downtime"] as const

export const requiredFields: readonly TelemetryField[] = ["timestamp", "machineId", "assemblyLine"]

const aliasEntries: readonly [string, TelemetryField][] = [
  ...sensorDefinitions.flatMap(definition => definition.aliases.map(alias => [alias, definition.key] as [string, TelemetryField])),
  ["date", "timestamp"], ["data", "timestamp"], ["timestamp", "timestamp"], ["datetime", "timestamp"], ["data_hora", "timestamp"], ["data e hora", "timestamp"], ["hora", "timestamp"],
  ["machine_id", "machineId"], ["machineid", "machineId"], ["machine", "machineId"], ["id_maquina", "machineId"], ["maquina", "machineId"], ["máquina", "machineId"], ["equipamento", "machineId"],
  ["assembly_line_no", "assemblyLine"], ["assembly_line", "assemblyLine"], ["assemblyline", "assemblyLine"], ["assemblylineno", "assemblyLine"], ["linha", "assemblyLine"], ["linha_montagem", "assemblyLine"], ["linha de montagem", "assemblyLine"],
  ["downtime", "downtime"], ["machine_failure", "downtime"], ["machinefailure", "downtime"], ["falha", "downtime"], ["parada", "downtime"], ["falha_maquina", "downtime"],
]

export function headerKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

const columnByAlias = new Map<string, TelemetryField>()
for (const [alias, field] of aliasEntries) columnByAlias.set(headerKey(alias), field)

export function fieldForHeader(value: unknown): TelemetryField | null {
  return columnByAlias.get(headerKey(value)) ?? null
}

export function fieldForColumn(value: string): TelemetryField | null {
  const column = telemetryColumns.find(item => item === value)
  if (!column) return null
  if (column === "date") return "timestamp"
  if (column === "machine_id") return "machineId"
  if (column === "assembly_line") return "assemblyLine"
  if (column === "downtime") return "downtime"
  return sensorDefinitions.find(definition => definition.column === column)?.key ?? null
}

/** Maps canonical columns to their dataset header. */
export const canonicalHeader: Record<TelemetryField, string> = {
  timestamp: "date", machineId: "machine_id", assemblyLine: "assembly_line", downtime: "downtime",
  ...Object.fromEntries(sensorDefinitions.map(definition => [definition.key, definition.column])),
} as Record<TelemetryField, string>

const SENTINELS = new Set(["", "na", "n/a", "nan", "null", "none", "sem dado", "-", "--", "undefined"])

export type ParsedNumber = { value: number | null; issue?: QualityIssue }

/**
 * Parses a numeric cell, applying the dataset cleaning rules.
 * `zero`, `negative`, sentinels and out-of-range values become null so they
 * never reach the dashboard as if they were real measurements.
 */
export function parseSensorNumber(raw: unknown, definition: Pick<SensorDefinition, "positive" | "min" | "max">): ParsedNumber {
  const text = String(raw ?? "").trim().replace(/\u00a0/g, " ").replace(/[−–—]/g, "-")
  if (!text || SENTINELS.has(text.toLowerCase())) return { value: null, issue: "missing" }
  let normalized = text.replace(/\s*(?:°\s*c|c|psi|bar|rpm|rpm|mm\s*\/\s*s|µm|um|nm|kn|v|volts?|h|horas?)\s*$/i, "").replace(/\s/g, "")
  if (normalized === "" || SENTINELS.has(normalized.toLowerCase())) return { value: null, issue: "missing" }
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "")
  } else if (normalized.includes(",")) {
    normalized = /^-?\d{1,3}(?:,\d{3}){2,}$/.test(normalized) ? normalized.replace(/,/g, "") : normalized.replace(",", ".")
  } else if (/^-?\d{1,3}(?:\.\d{3}){2,}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "")
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return { value: null, issue: "missing" }
  const number = Number(normalized)
  if (!Number.isFinite(number)) return { value: null, issue: "missing" }
  if (Math.abs(number) >= 1e9) return { value: null, issue: "sentinel" }
  if (definition.positive && number === 0) return { value: null, issue: "zero" }
  if (number < 0) return { value: null, issue: "negative" }
  if (number < definition.min || number > definition.max) return { value: null, issue: "outOfRange" }
  return { value: number }
}

const MONTHS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

/** Parses DD-MM-YYYY (dataset), DD/MM/YYYY, ISO and YYYY/MM/DD as UTC. */
export function parseTelemetryDate(value: unknown): Date | null {
  const text = String(value ?? "").trim()
  if (!text) return null
  const zoned = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?(Z|[+-]\d{2}:?\d{2})$/)
  if (zoned) {
    const year = +zoned[1], month = +zoned[2], day = +zoned[3], hour = +zoned[4], minute = +zoned[5], second = +(zoned[6] ?? 0)
    if (!MONTHS.has(month) || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null
    const calendar = new Date(Date.UTC(year, month - 1, day))
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null
    const parsed = new Date(text)
    if (!Number.isFinite(parsed.getTime())) return null
    return parsed
  }
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/)
  const local = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/)
  if (!iso && !local) return null
  const parts = iso
    ? [+iso[1], +iso[2], +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0), +(iso[7] ?? 0)]
    : [+local![3], +local![2], +local![1], +(local![4] ?? 0), +(local![5] ?? 0), +(local![6] ?? 0), +(local![7] ?? 0)]
  const [year, month, day, hour, minute, second, millisecond] = parts
  if (!MONTHS.has(month) || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

export type ParsedDowntime = { downtime: boolean | null; label: string | null; issue?: QualityIssue }

const TRUE_LABELS = new Set(["machine_failure", "machine failure", "falha", "falha_maquina", "falha na maquina", "true", "1", "sim", "yes"])
const FALSE_LABELS = new Set(["no_machine_failure", "no machine failure", "sem falha", "sem_falha", "false", "0", "nao", "não", "no"])

export function parseDowntimeLabel(value: unknown): ParsedDowntime {
  const text = String(value ?? "").trim()
  if (!text) return { downtime: null, label: null, issue: "missingLabel" }
  const key = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  if (TRUE_LABELS.has(key)) return { downtime: true, label: text }
  if (FALSE_LABELS.has(key)) return { downtime: false, label: text }
  return { downtime: null, label: text, issue: "missingLabel" }
}

export type ReadingStatus = "Falha" | "Crítico" | "Atenção" | "Normal"

export type ReadingEvaluation = {
  status: ReadingStatus
  critical: SensorKey[]
  warnings: SensorKey[]
}

/** Priority: downtime/failure, then critical sensor, then warning sensor. */
export function evaluateReading(values: Partial<Record<SensorKey, number | null>>, downtime: boolean | null | undefined): ReadingEvaluation {
  const critical: SensorKey[] = []
  const warnings: SensorKey[] = []
  for (const definition of sensorDefinitions) {
    const value = values[definition.key]
    if (value === null || value === undefined || !Number.isFinite(value)) continue
    const thresholds = definition.thresholds
    if (!thresholds) continue
    if ((thresholds.critLow !== undefined && value < thresholds.critLow) || (thresholds.critHigh !== undefined && value > thresholds.critHigh)) {
      critical.push(definition.key)
      continue
    }
    if ((thresholds.warnLow !== undefined && value < thresholds.warnLow) || (thresholds.warnHigh !== undefined && value > thresholds.warnHigh)) warnings.push(definition.key)
  }
  const status: ReadingStatus = downtime === true ? "Falha" : critical.length ? "Crítico" : warnings.length ? "Atenção" : "Normal"
  return { status, critical, warnings }
}

/** SQL predicate shared by the dashboard and the agent for triage alerts. */
export const criticalAlertSql = [
  "downtime IS TRUE",
  ...sensorDefinitions.flatMap(definition => {
    const thresholds = definition.thresholds
    if (!thresholds) return []
    const clauses: string[] = []
    if (thresholds.critLow !== undefined) clauses.push(`${definition.column} < ${thresholds.critLow}`)
    if (thresholds.critHigh !== undefined) clauses.push(`${definition.column} > ${thresholds.critHigh}`)
    return clauses
  }),
].join(" OR ")

export const alertDescription = "Parada registrada (downtime) ou sensor em faixa crítica de triagem."

/** Converts a stored row (Prisma or SQL) to the sensor map used by evaluateReading. */
export function valuesFromRow(row: Record<string, unknown>): Partial<Record<SensorKey, number | null>> {
  return Object.fromEntries(sensorDefinitions.map(definition => {
    const raw = row[definition.key] ?? row[definition.column]
    const value = raw === null || raw === undefined || raw === "" ? null : Number(raw)
    return [definition.key, value !== null && Number.isFinite(value) ? value : null]
  })) as Partial<Record<SensorKey, number | null>>
}

export function formatValue(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Ausente"
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)
  return unit ? `${formatted} ${unit}` : formatted
}
