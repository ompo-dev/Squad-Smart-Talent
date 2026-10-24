import {z} from "zod"
import {executeCommand,CommandConflict} from "./command-bus"
import {editableFields} from "@/lib/telemetry-edits"
export const updateRecordInput=z.object({expectedVersion:z.number().int().min(0),field:z.enum(editableFields),value:z.number().finite().nullable(),reason:z.string().trim().min(3).max(500)}).strict()
export async function updateRecord(id:number,args:unknown,key:string){
 const input=updateRecordInput.parse(args),ranges={temp_motor_c:[-100,1000],pressao_oleo_psi:[0,500],rpm:[0,10000],vibracao_mm_s:[0,100],consumo_l_h:[0,1000],horas_motor:[0,1000000]}
 const range=ranges[input.field];if(input.value!==null&&(input.value<range[0]||input.value>range[1]))throw new Error("Valor fora da faixa permitida")
 return executeCommand({type:"telemetry.update-record",idempotencyKey:key,payload:{id,...input}},async(tx,payload)=>{
   const before=await tx.$queryRawUnsafe<{value:number|null}[]>(`SELECT NULLIF(${payload.field},'NaN'::numeric)::float AS value FROM telemetry WHERE id_leitura=$1 FOR UPDATE`,id)
   if(!before.length)throw Object.assign(new Error("Leitura não encontrada"),{code:"P2025"})
   const updated=await tx.$queryRawUnsafe<{version:number}[]>(`UPDATE telemetry SET ${payload.field}=$2::numeric,version=version+1 WHERE id_leitura=$1 AND version=$3 RETURNING version`,id,payload.value,payload.expectedVersion)
   if(!updated.length)throw new CommandConflict("Outro usuário alterou este registro. Recarregue os dados antes de editar.")
   await tx.telemetryChange.create({data:{id:crypto.randomUUID(),readingId:id,field:payload.field,beforeValue:before[0].value,afterValue:payload.value,reason:payload.reason,status:"applied",expectedVersion:payload.expectedVersion,appliedVersion:updated[0].version,appliedAt:new Date()}})
   return {status:"applied",readingId:id,version:updated[0].version}
 })
}
