import {createHmac,timingSafeEqual} from "node:crypto"
import {z} from "zod"
import {executeCommand,CommandConflict} from "./command-bus"
import {parseSensorNumber,sensorDefinitions,type SensorKey} from "@/lib/telemetry-schema"
import {telemetryRecordKey} from "@/lib/telemetry-record-key"

const sensorShape = Object.fromEntries(sensorDefinitions.map(definition => [
  definition.column,
  z.number().finite().min(definition.min).max(definition.max).nullable().optional(),
]))
const readingInput = z.object({
  record_key: z.string().regex(/^[a-f0-9]{32}$/i).optional(),
  date: z.string().datetime(),
  machine_id: z.string().trim().min(1).max(120),
  assembly_line: z.string().trim().min(1).max(80),
  ...sensorShape,
  downtime: z.boolean().nullable().optional(),
  downtime_label: z.string().trim().max(40).nullable().optional(),
  expectedVersion: z.number().int().min(0).optional(),
}).strict()

export const webhookInput = z.object({
  eventId: z.string().regex(/^[a-zA-Z0-9._:-]{8,128}$/),
  readings: z.array(readingInput).min(1).max(500),
}).strict()

export function validWebhookSignature(raw: string | Uint8Array, timestamp: string | null, signature: string | null, secret: string, now = Date.now()) {
  if (!timestamp || !/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300000 || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest(), received = Buffer.from(signature.slice(7), "hex")
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export async function receiveTelemetryWebhook(body: unknown) {
  const input = webhookInput.parse(body)
  const readings = input.readings.map(row => {
    const timestamp = new Date(row.date)
    const qualityIssues: string[] = []
    const values = {} as Record<SensorKey, number | null>
    for (const definition of sensorDefinitions) {
      const raw = (row as Record<string, unknown>)[definition.column] as number | null | undefined
      if (raw === null || raw === undefined) {
        values[definition.key] = null
        continue
      }
      const parsed = parseSensorNumber(raw, definition)
      values[definition.key] = parsed.value
      if (parsed.issue) qualityIssues.push(`${definition.column}: ${parsed.issue}`)
    }
    const downtime = row.downtime ?? null
    const recordKey = row.record_key?.toLowerCase() ?? telemetryRecordKey({
      timestamp, machineId: row.machine_id, assemblyLine: row.assembly_line, downtime,
      ...values,
    })
    return {
      recordKey, timestamp, machineId: row.machine_id, assemblyLine: row.assembly_line,
      downtime, downtimeLabel: row.downtime_label ?? null, qualityIssues,
      expectedVersion: row.expectedVersion, values,
    }
  })
  if (new Set(readings.map(row => row.recordKey)).size !== readings.length) throw new Error("Leituras duplicadas no lote")

  return executeCommand({type: "telemetry.webhook", idempotencyKey: input.eventId, payload: input}, async tx => {
    const existing = await tx.telemetry.findMany({where: {recordKey: {in: readings.map(row => row.recordKey)}}, select: {recordKey: true, version: true}})
    const versions = new Map(existing.map(row => [row.recordKey, row.version]))
    let created = 0, updated = 0
    const results: {recordKey: string; version: number}[] = []
    for (const row of [...readings].sort((a, b) => a.recordKey.localeCompare(b.recordKey))) {
      const {values, expectedVersion, recordKey, timestamp, machineId, assemblyLine, downtime, downtimeLabel, qualityIssues} = row
      const data = {
        machineId, assemblyLine, timestamp, downtime, downtimeLabel, qualityIssues,
        ...Object.fromEntries(sensorDefinitions.map(definition => [definition.key, values[definition.key] ?? null])),
      }
      if (versions.has(recordKey)) {
        if (expectedVersion === undefined) throw new CommandConflict("Registros existentes exigem expectedVersion para atualizar.")
        const result = await tx.telemetry.updateMany({where: {recordKey, version: expectedVersion}, data: {...data, version: {increment: 1}}})
        if (!result.count) throw new CommandConflict("O registro foi atualizado por outra pessoa. Consulte a nova versão.")
        updated++
        results.push({recordKey, version: expectedVersion + 1})
      } else {
        if (expectedVersion !== undefined && expectedVersion !== 0) throw new CommandConflict("Versão inicial inválida")
        await tx.telemetry.create({data: {recordKey, ...data}})
        created++
        results.push({recordKey, version: 0})
      }
    }
    return {eventId: input.eventId, accepted: readings.length, created, updated, versions: results}
  })
}
