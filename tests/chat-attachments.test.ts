import {test,after} from "node:test"
import assert from "node:assert/strict"
import {createParser} from "@openuidev/lang-core"
import {MAX_ATTACHMENT_BYTES,canImportAttachment,selectAttachmentFiles} from "../lib/attachment-policy"
import {normalizeTelemetryAttachment} from "../lib/application/normalize-telemetry-file"
import {parseTelemetry} from "../lib/application/import-telemetry"
import {parseTelemetryDate} from "../lib/telemetry-schema"
import {attachmentImportStatus,confirmAttachmentImport,prepareAttachmentImport} from "../lib/application/attachment-import"
import {POST as attachmentImportRoute} from "../app/api/import/attachment/route"
import {executeAgentTool} from "../lib/agent-tools"
import {runAgent} from "../lib/chat-agent"
import {analysisSpec} from "../lib/openui-schema"
import {prisma} from "../lib/prisma"
import {closeRedis} from "../lib/cache/redis"
import type {ChatEvent} from "../lib/chat-types"

process.env.OBSERVABILITY_LOGS="off"
after(async()=>{await closeRedis();await prisma.$disconnect()})
const headers="date,machine_id,assembly_line,hydraulic_pressure_bar,coolant_pressure_bar,air_system_pressure_bar,coolant_temperature_c,hydraulic_oil_temperature_c,spindle_bearing_temperature_c,spindle_vibration_um,tool_vibration_um,spindle_speed_rpm,voltage_v,torque_nm,cutting_kn,downtime"
const reading=(id=1)=>({date:"2026-05-14T23:30:00.000Z",machine_id:`Makino-L1-Unit${id}-2013`,assembly_line:"Shopfloor-L1",hydraulic_pressure_bar:142.5,coolant_temperature_c:78.4,spindle_speed_rpm:21400,spindle_vibration_um:1.42,downtime:false,downtime_label:"No_Machine_Failure"})
const localFile=(name:string,size=100)=>({name,size,lastModified:1000})

test("anexos: limite, formatos, tamanho e duplicatas são verificados antes do envio",()=>{
  const csv=localFile("leituras.CSV"),pdf=localFile("manual.pdf"),json=localFile("dados.json"),xlsx=localFile("dados.xlsx")
  const selected=selectAttachmentFiles([csv,csv,pdf,json,xlsx,localFile("app.exe"),localFile("vazio.csv",0),localFile("grande.csv",MAX_ATTACHMENT_BYTES+1)],[])
  assert.deepEqual(selected.accepted,[csv,pdf,json]);assert.equal(selected.errors.length,4)
  assert.deepEqual(selectAttachmentFiles([csv,json],[csv,pdf]).accepted,[json])
  assert.equal(canImportAttachment("DADOS.XLSX"),true);assert.equal(canImportAttachment("manual.pdf"),false)
})

test("CSV com ponto e vírgula reconhece acentos, unidades e números brasileiros",()=>{
  const csv="Data;Máquina;Linha de montagem;Temperatura do refrigerante (°C);Pressão hidráulica (bar);Rotação;Vibração do spindle (µm);Força de corte (kN);Parada\n14-05-2026;Makino-L1-Unit1-2013;Shopfloor-L1;28,4;142,5;21400;1,42;12,4;No_Machine_Failure"
  const result=parseTelemetry(normalizeTelemetryAttachment("dados.csv",csv)),row=result.readings[0]
  assert.equal(result.valid,1);assert.equal(row.machineId,"Makino-L1-Unit1-2013");assert.equal(row.assemblyLine,"Shopfloor-L1")
  assert.equal(row.coolantTemperature,28.4);assert.equal(row.spindleSpeed,21400);assert.equal(row.spindleVibration,1.42);assert.equal(row.downtime,false)
  assert.equal(new Date(row.timestamp).toISOString(),"2026-05-14T00:00:00.000Z")
})

test("tabulações e JSON de API preservam datas com fuso e valores ausentes",()=>{
  const tsv=`date\tmachine_id\tassembly_line\tcoolant_temperature_c\tdowntime\n2026-05-14 23:30:00\tMakino-L1-Unit1-2013\tShopfloor-L1\t-999\tno`
  assert.equal(parseTelemetry(normalizeTelemetryAttachment("dados.csv",tsv)).readings[0].coolantTemperature,null)
  const json=JSON.stringify({readings:[{...reading(),date:"2026-05-14T20:30:00.125-03:00"}]})
  const row=parseTelemetry(normalizeTelemetryAttachment("dados.json",json)).readings[0]
  assert.equal(new Date(row.timestamp).toISOString(),"2026-05-14T23:30:00.125Z")
  assert.equal(parseTelemetryDate("2026-02-30T12:00:00Z"),null)
})

test("XLSX: abas auxiliares são ignoradas e fórmulas usam apenas o resultado armazenado",()=>{
  const columns=["date","machine_id","assembly_line","coolant_temperature_c","spindle_speed_rpm","spindle_vibration_um"]
  const content=['Planilha: Notas',JSON.stringify([null,"Resumo"]),'Planilha: Leituras',JSON.stringify([null,"Coleta de junho"]),JSON.stringify([null,...columns]),JSON.stringify([null,"2026-05-14T23:30:00.000Z","Makino-L1-Unit1-2013","Shopfloor-L1",{formula:"20+8.4",result:28.4},21400,1.42])].join("\n")
  const result=parseTelemetry(normalizeTelemetryAttachment("dados.xlsx",content))
  assert.equal(result.valid,1);assert.equal(result.readings[0].coolantTemperature,28.4)
})

test("normalização rejeita campos ambíguos, JSON malformado e formatos sem estrutura",()=>{
  assert.throws(()=>normalizeTelemetryAttachment("dados.csv",headers+",machine\n2026-05-14,Makino,Shopfloor-L1,140,5,6,25,50,40,1.3,31,20000,400,37,11,no,outra"),/Duas colunas/)
  assert.throws(()=>normalizeTelemetryAttachment("dados.json","{"),/JSON inválido/)
  assert.throws(()=>normalizeTelemetryAttachment("dados.json",JSON.stringify([{machine_id:"Makino"}])),/Colunas.*ausentes/)
  assert.throws(()=>normalizeTelemetryAttachment("manual.pdf","Texto"),/demais formatos podem ser analisados/)
  assert.throws(()=>normalizeTelemetryAttachment("dados.csv",headers+'\n2026-05-14,"Makino,Shopfloor-L1'),/CSV malformado/)
})

test("prévia identifica duplicatas, datas inválidas e campos obrigatórios vazios",()=>{
  const csv=`date,machine_id,assembly_line,coolant_temperature_c
2026-05-14,Makino-L1-Unit1-2013,Shopfloor-L1,28.4
2026-05-14,Makino-L1-Unit1-2013,Shopfloor-L1,28.4
31-02-2026,Makino-L1-Unit1-2013,Shopfloor-L1,28.4
2026-05-14,,Shopfloor-L1,28.4`
  const result=parseTelemetry(csv)
  assert.equal(result.received,4);assert.equal(result.valid,1);assert.equal(result.duplicates,1);assert.equal(result.invalid,2)
})

test("análise e prévia não gravam leituras; confirmação valida a prévia e cria um único job",async()=>{
  const id=crypto.randomUUID(),content=JSON.stringify({readings:[reading(),reading(),{...reading(2),date:"2026-02-30T12:00:00Z"}]})
  await prisma.chatFile.create({data:{id,name:"fixture-chat.json",mediaType:"application/json",size:content.length,content}})
  let key:string|undefined,jobId:string|undefined
  const before=await prisma.telemetry.count()
  try{
    const preview=await prepareAttachmentImport(id)
    assert.equal(preview.received,3);assert.equal(preview.valid,1);assert.equal(preview.duplicates,1);assert.equal(preview.invalid,1);assert.equal(preview.sample[0].coolantTemperature,78.4)
    const analysis=await executeAgentTool("analyze_uploaded_telemetry",{file_id:id})
    assert.equal(analysis.summary?.leituras_validas,1);assert.equal(analysis.summary?.temperatura_refrigerante_media_c,78.4);assert.equal(analysis.series?.[0].desktop,78.4)
    assert.equal((await executeAgentTool("prepare_telemetry_import",{file_id:id})).importPreview?.hash,preview.hash)
    assert.equal(await prisma.telemetry.count(),before)
    assert.equal((await attachmentImportStatus(id,preview.hash)).status,"pending")
    await assert.rejects(confirmAttachmentImport(id,"0".repeat(64)),/não corresponde/)
    const confirmations=await Promise.all([confirmAttachmentImport(id,preview.hash),confirmAttachmentImport(id,preview.hash)])
    jobId=confirmations[0].jobId;key=`ingestion.submit:chat-file-${id}-${preview.hash.slice(0,32)}`
    assert.ok(jobId);assert.equal(confirmations[1].jobId,jobId)
    assert.equal(await prisma.commandReceipt.count({where:{id:key}}),1)
    assert.equal((await attachmentImportStatus(id,preview.hash)).status,"queued")
    assert.equal(await prisma.telemetry.count(),before)
    const job=await prisma.importJob.findUniqueOrThrow({where:{id:jobId}})
    assert.equal(parseTelemetry(job.content).valid,1)
  }finally{
    if(jobId){await prisma.outboxEvent.deleteMany({where:{aggregateId:jobId}});await prisma.importJob.deleteMany({where:{id:jobId}})}
    if(key)await prisma.commandReceipt.deleteMany({where:{id:key}})
    await prisma.chatFile.deleteMany({where:{id}})
  }
})

test("análise calcula o arquivo completo e limita apenas a tabela e o gráfico",async()=>{
  const id=crypto.randomUUID(),content=JSON.stringify(Array.from({length:250},(_,index)=>({...reading(index+1),date:new Date(Date.UTC(2025,0,index+1)).toISOString(),coolant_temperature_c:30})))
  await prisma.chatFile.create({data:{id,name:"fixture-series.json",mediaType:"application/json",size:content.length,content}})
  try{
    const result=await executeAgentTool("analyze_uploaded_telemetry",{file_id:id})
    assert.equal(result.summary?.leituras_validas,250);assert.equal(result.summary?.temperatura_refrigerante_media_c,30)
    assert.equal(result.rows?.length,50);assert.equal(result.series?.length,200)
    assert.equal(result.series?.[0].date,new Date(Date.UTC(2025,0,51)).toISOString().slice(0,10))
  }finally{await prisma.chatFile.deleteMany({where:{id}})}
})

test("agente retorna um cartão ImportReview válido sem importar dados",async()=>{
  const id=crypto.randomUUID(),content=JSON.stringify([reading()]),originalFetch=globalThis.fetch
  await prisma.chatFile.create({data:{id,name:"fixture-agent.json",mediaType:"application/json",size:content.length,content}})
  const before=await prisma.telemetry.count();let calls=0
  globalThis.fetch=async(_url,init)=>{
    const body=JSON.parse(String(init?.body));calls++
    if(calls===1)return Response.json({choices:[{message:{role:"assistant",content:null,tool_calls:[{id:"preview_fixture",type:"function",function:{name:"prepare_telemetry_import",arguments:JSON.stringify({file_id:id})}}]}}]})
    const tool=body.messages.find((message:{role:string})=>message.role==="tool")
    assert.equal(JSON.parse(tool.content).importPreview.valid,1)
    return Response.json({choices:[{message:{role:"assistant",content:'root = Analysis("Revisar arquivo", "Uma leitura válida. Confirme no cartão para adicionar à base.", [preview])\npreview = ImportReview("preview_fixture")'}}]})
  }
  try{
    const events:ChatEvent[]=[]
    await runAgent({question:`Prepare a importação do anexo. [Anexo: fixture-agent.json; arquivo_id: ${id}]`},"test-only",new AbortController().signal,event=>events.push(event))
    const answer=events.findLast(event=>event.type==="answer")
    assert.ok(answer&&answer.type==="answer")
    const parsed=createParser(analysisSpec.toJSONSchema(),"Analysis").parse(answer.content)
    assert.ok(parsed.root);assert.equal(parsed.meta.errors.length,0);assert.equal(calls,2);assert.equal(await prisma.telemetry.count(),before)
  }finally{globalThis.fetch=originalFetch;await prisma.chatFile.deleteMany({where:{id}})}
})

test("rota de importação exige ação e hash explícitos e limita o corpo",async()=>{
  const request=(body:string)=>new Request("http://localhost/api/import/attachment",{method:"POST",body})
  assert.equal((await attachmentImportRoute(request(JSON.stringify({action:"confirm",fileId:crypto.randomUUID()})))).status,400)
  assert.equal((await attachmentImportRoute(request("x".repeat(4097)))).status,413)
  assert.equal((await attachmentImportRoute(request(JSON.stringify({action:"preview",fileId:crypto.randomUUID()})))).status,404)
})
