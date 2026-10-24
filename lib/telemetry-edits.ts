import { z } from "zod"
import { pool } from "@/lib/agent-tools"
import { ensureChatSchema } from "@/lib/chat-db"
export const editableFields = ["temp_motor_c","pressao_oleo_psi","rpm","vibracao_mm_s","consumo_l_h","horas_motor"] as const
const ranges = {temp_motor_c:[-100,1000],pressao_oleo_psi:[0,500],rpm:[0,10000],vibracao_mm_s:[0,100],consumo_l_h:[0,1000],horas_motor:[0,1000000]} as const
export const changeInput = z.object({reading_id:z.number().int().positive(),field:z.enum(editableFields),value:z.number().finite().nullable(),reason:z.string().trim().min(3).max(500)}).strict()
export async function proposeChange(args:unknown) {
  const input=changeInput.parse(args)
  const range=ranges[input.field]
  if(input.value!==null&&(input.value<range[0]||input.value>range[1])) throw new Error("Valor fora da faixa permitida")
  await ensureChatSchema()
  const found=await pool.query(`SELECT NULLIF(${input.field},'NaN'::numeric)::float AS value FROM telemetry WHERE id_leitura=$1`,[input.reading_id])
  if(!found.rowCount) throw new Error("Leitura não encontrada")
  const id=crypto.randomUUID(), before=found.rows[0].value as number|null
  await pool.query("INSERT INTO telemetry_changes(id,reading_id,field,before_value,after_value,reason) VALUES($1,$2,$3,$4,$5,$6)",[id,input.reading_id,input.field,before,input.value,input.reason])
  return {change:{id,readingId:input.reading_id,field:input.field,before,after:input.value,status:"pending"},description:"Proposta pendente. Nenhum dado de telemetria foi alterado. O usuário precisa confirmar no cartão da interface."}
}
export async function applyChange(id:string) {
  await ensureChatSchema()
  const client=await pool.connect()
  try {
    await client.query("BEGIN")
    const found=await client.query("SELECT * FROM telemetry_changes WHERE id=$1 FOR UPDATE",[id])
    const change=found.rows[0]
    if(!change) throw new Error("Alteração não encontrada")
    if(change.status==="applied") {await client.query("COMMIT"); return {status:"applied",readingId:change.reading_id}}
    if(change.status!=="pending"||Date.now()-new Date(change.created_at).getTime()>86400000) throw new Error("Proposta expirada; peça uma nova prévia")
    const field=z.enum(editableFields).parse(change.field)
    const updated=await client.query(`UPDATE telemetry SET ${field}=$2 WHERE id_leitura=$1 AND NULLIF(${field},'NaN'::numeric) IS NOT DISTINCT FROM $3::numeric RETURNING id_leitura`,[change.reading_id,change.after_value,change.before_value])
    if(!updated.rowCount) throw new Error("O registro mudou após a prévia; solicite uma nova proposta")
    await client.query("UPDATE telemetry_changes SET status='applied',applied_at=now() WHERE id=$1",[id])
    await client.query("COMMIT")
    return {status:"applied",readingId:change.reading_id}
  } catch(error) {await client.query("ROLLBACK");throw error} finally {client.release()}
}
