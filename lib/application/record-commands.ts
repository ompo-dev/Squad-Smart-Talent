import {z} from "zod"
import {executeCommand,CommandConflict} from "./command-bus"
import {editableFields} from "@/lib/telemetry-edits"
import {sensorDefinitions} from "@/lib/telemetry-schema"

const editableByColumn = new Map(sensorDefinitions.map(definition => [definition.column, definition]))

export const updateRecordInput = z.object({
  expectedVersion: z.number().int().min(0),
  field: z.enum(editableFields),
  value: z.number().finite().nullable(),
  reason: z.string().trim().min(3).max(500),
}).strict()

export async function updateRecord(id: number, args: unknown, key: string) {
  const input = updateRecordInput.parse(args)
  const definition = editableByColumn.get(input.field)
  if (!definition) throw new Error("Campo não editável")
  if (input.value !== null && (input.value < definition.min || input.value > definition.max)) throw new Error("Valor fora da faixa permitida")
  return executeCommand({type: "telemetry.update-record", idempotencyKey: key, payload: {id, ...input}}, async (tx, payload) => {
    const before = await tx.$queryRawUnsafe<{value: number | null}[]>(`SELECT ${payload.field}::float AS value FROM telemetry WHERE id=$1 FOR UPDATE`, BigInt(id))
    if (!before.length) throw Object.assign(new Error("Leitura não encontrada"), {code: "P2025"})
    const updated = await tx.$queryRawUnsafe<{version: number}[]>(`UPDATE telemetry SET ${payload.field}=$2::numeric,version=version+1 WHERE id=$1 AND version=$3 RETURNING version`, BigInt(id), payload.value, payload.expectedVersion)
    if (!updated.length) throw new CommandConflict("Outro usuário alterou este registro. Recarregue os dados antes de editar.")
    await tx.telemetryChange.create({
      data: {
        id: crypto.randomUUID(),
        readingId: BigInt(id),
        field: payload.field,
        beforeValue: before[0].value,
        afterValue: payload.value,
        reason: payload.reason,
        status: "applied",
        expectedVersion: payload.expectedVersion,
        appliedVersion: updated[0].version,
        appliedAt: new Date(),
      },
    })
    return {status: "applied", readingId: id, version: updated[0].version}
  })
}
