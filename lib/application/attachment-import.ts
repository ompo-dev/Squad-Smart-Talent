import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {CommandConflict,payloadHash} from "@/lib/application/command-bus"
import {parseTelemetry} from "@/lib/application/import-telemetry"
import {normalizeTelemetryAttachment} from "@/lib/application/normalize-telemetry-file"
import {submitImport} from "@/lib/application/import-jobs"
import {evaluateReading} from "@/lib/telemetry-schema"
import type {AttachmentImportStatus,TelemetryImportPreview,TelemetryImportResult,ToolResult} from "@/lib/chat-types"

const fileId=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/)
export const attachmentImportInput=z.discriminatedUnion("action",[
  z.object({action:z.literal("preview"),fileId}).strict(),
  z.object({action:z.literal("confirm"),fileId,previewHash:hash}).strict(),
  z.object({action:z.literal("status"),fileId,previewHash:hash}).strict(),
])
function importKey(id:string,hash:string){return `chat-file-${id}-${hash.slice(0,32)}`}
export class AttachmentValidationError extends Error{
  constructor(message:string){super(message);this.name="AttachmentValidationError"}
}
async function readTelemetryFile(id:string){
  const file=await prisma.chatFile.findUniqueOrThrow({where:{id},select:{name:true,content:true}})
  try{const csv=normalizeTelemetryAttachment(file.name,file.content);return {file,csv,parsed:parseTelemetry(csv)}}
  catch(error){throw new AttachmentValidationError(error instanceof Error?error.message.slice(0,1000):"Não foi possível normalizar o arquivo.")}
}

async function prepare(id:string){
  const {file,csv,parsed}=await readTelemetryFile(id)
  const preview:TelemetryImportPreview={
    fileId:id,name:file.name,hash:payloadHash({fileId:id,csv}),received:parsed.received,valid:parsed.valid,duplicates:parsed.duplicates,invalid:parsed.invalid,errors:parsed.errors,quality:parsed.quality,
    sample:parsed.readings.slice(0,5).map(row=>({
      recordKey:row.recordKey,machineId:row.machineId,assemblyLine:row.assemblyLine,timestamp:row.timestamp.toISOString(),
      status:evaluateReading(row,row.downtime).status,coolantTemperature:row.coolantTemperature,spindleVibration:row.spindleVibration,downtime:row.downtime,
    })),
  }
  return {csv,preview}
}
export async function prepareAttachmentImport(id:string){return (await prepare(fileId.parse(id))).preview}

export async function analyzeAttachmentTelemetry(id:string):Promise<ToolResult["data"]>{
  const {file,parsed}=await readTelemetryFile(fileId.parse(id))
  const machines=new Set<string>(),lines=new Set<string>(),days=new Map<string,{sum:number;count:number;max:number}>()
  let temperature=0,temperatures=0,downtimeReadings=0,criticalReadings=0,start="",end=""
  const rows:Record<string,unknown>[]=[]
  for(const row of parsed.readings){
    const timestamp=row.timestamp.toISOString(),value=row.coolantTemperature
    machines.add(row.machineId);lines.add(row.assemblyLine);if(!start||timestamp<start)start=timestamp;if(timestamp>end)end=timestamp
    const evaluation=evaluateReading(row,row.downtime)
    if(row.downtime===true)downtimeReadings++
    if(evaluation.status==="Falha"||evaluation.status==="Crítico")criticalReadings++
    if(value!==null){
      temperature+=value;temperatures++
      const day=timestamp.slice(0,10),entry=days.get(day)??{sum:0,count:0,max:-Infinity}
      entry.sum+=value;entry.count++;entry.max=Math.max(entry.max,value);days.set(day,entry)
    }
    if(rows.length<50)rows.push({recordKey:row.recordKey,machine_id:row.machineId,assembly_line:row.assemblyLine,date:timestamp,coolant_temperature_c:value,spindle_vibration_um:row.spindleVibration,spindle_bearing_temperature_c:row.spindleBearingTemperature,downtime:row.downtime,status:evaluation.status,quality_issues:row.qualityIssues})
  }
  return {
    rows,series:[...days].sort(([a],[b])=>a.localeCompare(b)).slice(-200).map(([date,day])=>({date,desktop:Number((day.sum/day.count).toFixed(2)),mobile:day.max})),
    summary:{
      arquivo:file.name,recebidas:parsed.received,leituras_validas:parsed.valid,maquinas:machines.size,linhas:lines.size,
      duplicadas:parsed.duplicates,invalidas:parsed.invalid,inicio:start,fim:end,temperatura_refrigerante_media_c:temperatures?Number((temperature/temperatures).toFixed(2)):null,
      paradas:downtimeReadings,leituras_criticas:criticalReadings,celulas_corrigidas:parsed.quality.repairedCells,outliers_sinalizados:parsed.quality.outlierCells,
      rotulos_ausentes:parsed.quality.missingLabels,
    },
    description:`Análise de ${file.name}, sem adicionar leituras à base. O arquivo passou pela limpeza automática (${parsed.quality.repairedCells} células corrigidas e ${parsed.quality.outlierCells} outliers sinalizados). Indicadores calculados sobre todas as leituras válidas; tabela limitada a 50. Gráfico: média e máxima diária da temperatura do refrigerante em °C, até 200 dias mais recentes.`,
  }
}

export async function attachmentImportStatus(id:string,previewHash:string):Promise<AttachmentImportStatus>{
  fileId.parse(id);hash.parse(previewHash)
  const receipt=await prisma.commandReceipt.findUnique({where:{id:`ingestion.submit:${importKey(id,previewHash)}`},select:{result:true}})
  if(!receipt)return {status:"pending"}
  const jobId=(receipt.result as {jobId:string}).jobId
  const job=await prisma.importJob.findUnique({where:{id:jobId},select:{status:true,result:true,errorCode:true}})
  if(!job)return {status:"failed",error:"O processamento deste arquivo não está mais disponível. Consulte as importações."}
  const status=(["queued","running","completed","failed"] as const).find(status=>status===job.status)??"failed"
  return {status,jobId,...(job.result?{result:job.result as unknown as TelemetryImportResult}:{}),...(status==="failed"?{error:job.errorCode==="INVALID_CSV"?"O arquivo não contém leituras válidas.":"Não foi possível concluir a importação. Consulte as importações para tentar novamente."}:{})}
}
export async function confirmAttachmentImport(id:string,previewHash:string):Promise<AttachmentImportStatus>{
  const {csv,preview}=await prepare(fileId.parse(id))
  if(hash.parse(previewHash)!==preview.hash)throw new CommandConflict("A prévia não corresponde ao arquivo. Prepare a importação novamente.")
  const status=await attachmentImportStatus(id,previewHash)
  if(status.status!=="pending")return status
  const job=await submitImport(csv,preview.name,importKey(id,previewHash))
  return {status:"queued",jobId:job.jobId}
}
