import {evaluateReading,valuesFromRow} from "@/lib/telemetry-schema"
import type {ReadingStatus,TelemetryRow} from "@/lib/types"

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value)
}

/**
 * Converts a database row, agent result or import preview into the complete
 * row consumed by the telemetry table. All sensors are preserved so the UI
 * never hides columns that exist in the database.
 */
export function telemetryRowFromRecord(record: Record<string, unknown>, fallbackId = 1): TelemetryRow {
  const sensors = valuesFromRow(record)
  const timestampValue = record.timestamp ?? record.date
  const timestamp = timestampValue instanceof Date
    ? timestampValue.toISOString()
    : timestampValue ? new Date(String(timestampValue)).toISOString() : new Date(0).toISOString()
  const downtime = record.downtime === null || record.downtime === undefined ? null : Boolean(record.downtime)
  const status = typeof record.status === "string" && record.status
    ? record.status as ReadingStatus
    : evaluateReading(sensors, downtime).status
  const qualityIssues = Array.isArray(record.qualityIssues)
    ? record.qualityIssues.map(String)
    : Array.isArray(record.quality_issues) ? record.quality_issues.map(String) : []
  const idValue = record.id
  const id = idValue === null || idValue === undefined || idValue === "" ? fallbackId : Number(idValue)
  return {
    id: Number.isFinite(id) ? id : fallbackId,
    recordKey: text(record.recordKey ?? record.record_key),
    version: Number(record.version ?? 0),
    machineId: text(record.machineId ?? record.machine_id),
    assemblyLine: text(record.assemblyLine ?? record.assembly_line),
    timestamp,
    status,
    hydraulicPressure: sensors.hydraulicPressure ?? null,
    coolantPressure: sensors.coolantPressure ?? null,
    airSystemPressure: sensors.airSystemPressure ?? null,
    coolantTemperature: sensors.coolantTemperature ?? null,
    hydraulicOilTemperature: sensors.hydraulicOilTemperature ?? null,
    spindleBearingTemperature: sensors.spindleBearingTemperature ?? null,
    spindleVibration: sensors.spindleVibration ?? null,
    toolVibration: sensors.toolVibration ?? null,
    spindleSpeed: sensors.spindleSpeed ?? null,
    voltage: sensors.voltage ?? null,
    torque: sensors.torque ?? null,
    cutting: sensors.cutting ?? null,
    downtime,
    downtimeLabel: record.downtimeLabel === null || record.downtimeLabel === undefined
      ? (record.downtime_label === null || record.downtime_label === undefined ? null : String(record.downtime_label))
      : String(record.downtimeLabel),
    qualityIssues,
  }
}
