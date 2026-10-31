import {z} from "zod"
import {executeCommand} from "@/lib/application/command-bus"
import {sensorDefinitions,type SensorKey} from "@/lib/telemetry-schema"

const editable = sensorDefinitions.map(definition => ({
  column: definition.column,
  key: definition.key,
  min: definition.min,
  max: definition.max,
}))
export const editableFields = editable.map(item => item.column) as [string, ...string[]]
const editableByColumn = new Map(editable.map(item => [item.column, item]))

export const changeInput = z.object({
  reading_id: z.number().int().positive().max(2147483647),
  field: z.enum(editableFields),
  value: z.number().finite().nullable(),
  reason: z.string().trim().min(3).max(500),
}).strict()

function validateValue(field: string, value: number | null) {
  const range = editableByColumn.get(field)
  if (!range) throw new Error("Campo não editável")
  if (value !== null && (value < range.min || value > range.max)) throw new Error("Valor fora da faixa permitida")
}

export async function proposeChange(args: unknown, key?: string) {
  const input = changeInput.parse(args)
  validateValue(input.field, input.value)
  const keyForField = editableByColumn.get(input.field)!.key as SensorKey
  return executeCommand({type: "telemetry.propose-change", payload: input, idempotencyKey: key}, async (tx, payload) => {
    const row = await tx.telemetry.findUniqueOrThrow({where: {id: BigInt(payload.reading_id)}})
    const raw = row[keyForField]
    const value = raw === null ? null : Number(raw)
    const before = value !== null && Number.isFinite(value) ? value : null
    const proposal = await tx.telemetryChange.create({
      data: {
        id: crypto.randomUUID(),
        readingId: BigInt(payload.reading_id),
        field: payload.field,
        beforeValue: before,
        afterValue: payload.value,
        reason: payload.reason,
        expectedVersion: row.version,
      },
    })
    return {
      change: {id: proposal.id, readingId: payload.reading_id, field: payload.field, before, after: payload.value, status: "pending"},
      description: "Proposta pendente. Nenhum dado de telemetria foi alterado. Confirme no cartão da interface.",
    }
  })
}

export async function applyChange(id: string, key?: string) {
  return executeCommand({type: "telemetry.apply-change", idempotencyKey: key ?? id, payload: {id}}, async (tx, payload) => {
    const change = await tx.telemetryChange.findUniqueOrThrow({where: {id: payload.id}})
    if (change.status === "applied") return {status: "applied", readingId: Number(change.readingId)}
    if (change.status !== "pending" || Date.now() - change.createdAt.getTime() > 86400000) throw new Error("Proposta expirada; peça uma nova prévia")
    const field = z.enum(editableFields).parse(change.field)
    validateValue(field, change.afterValue === null ? null : Number(change.afterValue))
    const updated = await tx.$queryRawUnsafe<{id: bigint; version: number}[]>(
      `UPDATE telemetry SET ${field}=$2::numeric,version=version+1 WHERE id=$1 AND version=$4 AND ${field} IS NOT DISTINCT FROM $3::numeric RETURNING id,version`,
      change.readingId,
      change.afterValue?.toString() ?? null,
      change.beforeValue?.toString() ?? null,
      change.expectedVersion,
    )
    if (!updated.length) throw new Error("O registro mudou após a prévia; solicite uma nova proposta")
    await tx.telemetryChange.update({where: {id: change.id}, data: {status: "applied", appliedAt: new Date(), appliedVersion: updated[0].version}})
    return {status: "applied", readingId: Number(updated[0].id), version: updated[0].version}
  })
}
