import {createHash} from "node:crypto"
import {sensorDefinitions, type SensorKey} from "@/lib/telemetry-schema"

export type RecordKeyInput = {
  timestamp: Date | string
  machineId: string
  assemblyLine: string
  downtime: boolean | null
} & Partial<Record<SensorKey, number | null>>

/**
 * Deterministic key built from the cleaned reading. It makes imports
 * idempotent and deduplicates rows that repeat machine, line, date and values.
 */
export function telemetryRecordKey(reading: RecordKeyInput) {
  const timestamp = reading.timestamp instanceof Date ? reading.timestamp.toISOString() : new Date(reading.timestamp).toISOString()
  const canonical = [
    timestamp,
    reading.machineId,
    reading.assemblyLine,
    ...sensorDefinitions.map(definition => reading[definition.key] ?? null),
    reading.downtime ?? null,
  ]
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 32)
}
