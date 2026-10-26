import {parse} from "csv-parse/sync"
import {executeCommand,payloadHash} from "@/lib/application/command-bus"
import type {Prisma} from "@/generated/prisma/client"
export function sensorNumber(value:unknown,nonNegative=false):number|null {
 const text=String(value??"").trim();if(!text)return null
 const number=Number(text.includes(",")?text.replace(/\./g,"").replace(",","."):text)
 return !Number.isFinite(number)||number===-999||(nonNegative&&number<0)?null:number
}
export function telemetryDate(value:string) {
 const zoned=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/)
 if(zoned){
   telemetryDate(`${zoned[1]} ${zoned[2]}`)
   const date=new Date(value)
   if(!Number.isFinite(date.getTime()))throw new Error("Data ou fuso inválido")
   return date
 }
 const brazil=value.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
 const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
 if(!brazil&&!iso)throw new Error("Data inválida")
 const parts=brazil?[+brazil[3],+brazil[2],+brazil[1],+brazil[4],+brazil[5],+(brazil[6]??0)]:[+iso![1],+iso![2],+iso![3],+iso![4],+iso![5],+(iso![6]??0)]
 const [year,month,day,hour,minute,second]=parts,date=new Date(Date.UTC(year,month-1,day,hour,minute,second))
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||hour>23||minute>59||second>59)throw new Error("Data fora do calendário")
 return date
}
export function parseTelemetry(csv:string) {
 if(csv.length>5*1024*1024)throw new Error("CSV excede 5 MB")
 const rows=parse(csv,{columns:true,bom:true,skip_empty_lines:true,trim:true}) as Record<string,string>[]
 const required=["id_leitura","id_maquina","data_hora","temp_motor_c","pressao_oleo_psi","rpm","vibracao_mm_s","consumo_l_h","horas_motor"]
 if(!rows.length||required.some(field=>!(field in rows[0])))throw new Error("O CSV precisa conter as nove colunas de telemetria")
 const seen=new Set<string>(),valid:Prisma.TelemetryCreateManyInput[]=[],errors:string[]=[];let duplicates=0,invalid=0
 for(const [index,row] of rows.entries())try {
   if(!/^\d+$/.test(row.id_leitura)||!/^\d+$/.test(row.id_maquina)||+row.id_maquina<1||+row.id_maquina>2147483647)throw new Error("Identificadores inválidos")
   const id=BigInt(row.id_leitura);if(id<BigInt(1)||id>BigInt("9223372036854775807"))throw new Error("ID inválido")
   if(seen.has(String(id))){duplicates++;continue}
   valid.push({id,machineId:+row.id_maquina,timestamp:telemetryDate(row.data_hora),temperature:sensorNumber(row.temp_motor_c),oilPressure:sensorNumber(row.pressao_oleo_psi,true),rpm:sensorNumber(row.rpm,true),vibration:sensorNumber(row.vibracao_mm_s,true),consumption:sensorNumber(row.consumo_l_h,true),engineHours:sensorNumber(row.horas_motor,true)})
   seen.add(String(id))
 }catch(error){invalid++;if(errors.length<5)errors.push(`Linha ${index+2}: ${error instanceof Error?error.message:"inválida"}`)}
 if(!valid.length)throw new Error("Nenhuma leitura válida no arquivo")
 valid.sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:BigInt(a.id)>BigInt(b.id)?1:0)
 return {readings:valid,received:rows.length,valid:valid.length,duplicates,invalid,errors}
}
export async function importTelemetry(csv:string,key?:string) {
 const {readings:valid,received,duplicates,invalid,errors}=parseTelemetry(csv)
 return executeCommand({type:"telemetry.import-csv",idempotencyKey:key??payloadHash(csv),payload:{hash:payloadHash(csv)}},async tx=>{
   let inserted=0
   for(let offset=0;offset<valid.length;offset+=500)inserted+=(await tx.telemetry.createMany({data:valid.slice(offset,offset+500),skipDuplicates:true})).count
   return {received,valid:valid.length,inserted,existing:valid.length-inserted,duplicates,invalid,errors}
 })
}
