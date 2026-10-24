import {z} from "zod"
import {executeCommand} from "@/lib/application/command-bus"
export const editableFields=["temp_motor_c","pressao_oleo_psi","rpm","vibracao_mm_s","consumo_l_h","horas_motor"] as const
const fieldMap={temp_motor_c:"temperature",pressao_oleo_psi:"oilPressure",rpm:"rpm",vibracao_mm_s:"vibration",consumo_l_h:"consumption",horas_motor:"engineHours"} as const
const ranges={temp_motor_c:[-100,1000],pressao_oleo_psi:[0,500],rpm:[0,10000],vibracao_mm_s:[0,100],consumo_l_h:[0,1000],horas_motor:[0,1000000]} as const
export const changeInput=z.object({reading_id:z.number().int().positive().max(2147483647),field:z.enum(editableFields),value:z.number().finite().nullable(),reason:z.string().trim().min(3).max(500)}).strict()
export async function proposeChange(args:unknown,key?:string) {
 const input=changeInput.parse(args),range=ranges[input.field]
 if(input.value!==null&&(input.value<range[0]||input.value>range[1]))throw new Error("Valor fora da faixa permitida")
 return executeCommand({type:"telemetry.propose-change",payload:input,idempotencyKey:key},async(tx,payload)=>{
   const row=await tx.telemetry.findUniqueOrThrow({where:{id:BigInt(payload.reading_id)}}),value=row[fieldMap[payload.field]]?.toNumber()
   const before=value!==undefined&&Number.isFinite(value)?value:null
   const proposal=await tx.telemetryChange.create({data:{id:crypto.randomUUID(),readingId:payload.reading_id,field:payload.field,beforeValue:before,afterValue:payload.value,reason:payload.reason,expectedVersion:row.version}})
   return {change:{id:proposal.id,readingId:payload.reading_id,field:payload.field,before,after:payload.value,status:"pending"},description:"Proposta pendente. Nenhum dado de telemetria foi alterado. Confirme no cartão da interface."}
 })
}
export async function applyChange(id:string,key?:string) {
 return executeCommand({type:"telemetry.apply-change",idempotencyKey:key??id,payload:{id}},async(tx,payload)=>{
   const change=await tx.telemetryChange.findUniqueOrThrow({where:{id:payload.id}})
   if(change.status==="applied")return {status:"applied",readingId:change.readingId}
   if(change.status!=="pending"||Date.now()-change.createdAt.getTime()>86400000)throw new Error("Proposta expirada; peça uma nova prévia")
   const field=z.enum(editableFields).parse(change.field)
   const updated=await tx.$queryRawUnsafe<{id_leitura:bigint;version:number}[]>(`UPDATE telemetry SET ${field}=$2::numeric,version=version+1 WHERE id_leitura=$1 AND version=$4 AND NULLIF(${field},'NaN'::numeric) IS NOT DISTINCT FROM $3::numeric RETURNING id_leitura,version`,change.readingId,change.afterValue?.toString()??null,change.beforeValue?.toString()??null,change.expectedVersion)
   if(!updated.length)throw new Error("O registro mudou após a prévia; solicite uma nova proposta")
   await tx.telemetryChange.update({where:{id:change.id},data:{status:"applied",appliedAt:new Date(),appliedVersion:updated[0].version}})
   return {status:"applied",readingId:change.readingId,version:updated[0].version}
 })
}
