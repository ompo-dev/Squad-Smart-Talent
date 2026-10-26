import {test,after} from "node:test"
import assert from "node:assert/strict"
import {createParser} from "@openuidev/lang-core"
import {MAX_ATTACHMENT_BYTES,canImportAttachment,selectAttachmentFiles} from "../lib/attachment-policy"
import {normalizeTelemetryAttachment} from "../lib/application/normalize-telemetry-file"
import {parseTelemetry,telemetryDate} from "../lib/application/import-telemetry"
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
const headers="id_leitura,id_maquina,data_hora,temp_motor_c,pressao_oleo_psi,rpm,vibracao_mm_s,consumo_l_h,horas_motor"
const reading=(id=1900000001)=>({id,machineId:1,timestamp:"2026-05-14T23:30:00.000Z",temperature:78.4,oilPressure:55,rpm:1000,vibration:2.35,consumption:12,engineHours:500})
const localFile=(name:string,size=100)=>({name,size,lastModified:1000})

test("anexos: limite, formatos, tamanho e duplicatas são verificados antes do envio",()=>{
  const csv=localFile("leituras.CSV"),pdf=localFile("manual.pdf"),json=localFile("dados.json"),xlsx=localFile("dados.xlsx")
  const selected=selectAttachmentFiles([csv,csv,pdf,json,xlsx,localFile("app.exe"),localFile("vazio.csv",0),localFile("grande.csv",MAX_ATTACHMENT_BYTES+1)],[])
  assert.deepEqual(selected.accepted,[csv,pdf,json]);assert.equal(selected.errors.length,4)
  assert.deepEqual(selectAttachmentFiles([csv,json],[csv,pdf]).accepted,[json])
  assert.equal(canImportAttachment("DADOS.XLSX"),true);assert.equal(canImportAttachment("manual.pdf"),false)
})

test("CSV com ponto e vírgula reconhece acentos, unidades e números brasileiros",()=>{
  const csv="ID leitura;Máquina;Data e hora;Temperatura (°C);Pressão óleo (psi);Rotação;Vibração (mm/s);Consumo (L/h);Horas do motor\n1;2;14/05/2026 23:30;78,4;55;1.000,0;2,35;12;500"
  const result=parseTelemetry(normalizeTelemetryAttachment("dados.csv",csv)),row=result.readings[0]
  assert.equal(result.valid,1);assert.equal(row.machineId,2);assert.equal(row.temperature,78.4);assert.equal(row.rpm,1000);assert.equal(row.vibration,2.35)
  assert.equal(new Date(row.timestamp).toISOString(),"2026-05-14T23:30:00.000Z")
})

test("tabulações e JSON de API preservam datas com fuso e valores ausentes",()=>{
  const tsv=headers.replaceAll(",","\t")+"\n1\t1\t2026-05-14 23:30:00\t-999\t55\t1000\t2\t12\t500"
  assert.equal(parseTelemetry(normalizeTelemetryAttachment("dados.csv",tsv)).readings[0].temperature,null)
  const json=JSON.stringify({readings:[{...reading(),timestamp:"2026-05-14T20:30:00.125-03:00"}]})
  const row=parseTelemetry(normalizeTelemetryAttachment("dados.json",json)).readings[0]
  assert.equal(new Date(row.timestamp).toISOString(),"2026-05-14T23:30:00.125Z")
  assert.throws(()=>telemetryDate("2026-02-30T12:00:00Z"),/calendário/)
})

test("XLSX: abas auxiliares são ignoradas e fórmulas usam apenas o resultado armazenado",()=>{
  const columns=["id","machineId","timestamp","temperature","oilPressure","rpm","vibration","consumption","engineHours"]
  const content=['Planilha: Notas',JSON.stringify([null,"Resumo"]),'Planilha: Leituras',JSON.stringify([null,"Coleta de maio"]),JSON.stringify([null,...columns]),JSON.stringify([null,1,2,"2026-05-14T23:30:00.000Z",{formula:"70+8.4",result:78.4},55,1000,2.35,12,500])].join("\n")
  const result=parseTelemetry(normalizeTelemetryAttachment("dados.xlsx",content))
  assert.equal(result.valid,1);assert.equal(result.readings[0].temperature,78.4)
})

test("normalização rejeita campos ambíguos, JSON malformado e formatos sem estrutura",()=>{
  assert.throws(()=>normalizeTelemetryAttachment("dados.csv",headers+",id\n1,1,2026-05-14 23:30,80,55,1000,2,12,500,2"),/Duas colunas/)
  assert.throws(()=>normalizeTelemetryAttachment("dados.json","{"),/JSON inválido/)
  assert.throws(()=>normalizeTelemetryAttachment("dados.json",JSON.stringify([{id:1,machineId:2}])),/Colunas.*ausentes/)
  assert.throws(()=>normalizeTelemetryAttachment("manual.pdf","Texto"),/demais formatos podem ser analisados/)
  assert.throws(()=>normalizeTelemetryAttachment("dados.csv",headers+'\n1,1,"2026-05-14 23:30,80,55,1000,2,12,500'),/CSV malformado/)
})

test("prévia identifica duplicatas, datas inválidas e IDs maiores que o banco aceita",()=>{
  const result=parseTelemetry(headers+'\n1,1,2026-05-14 23:30,"78,4",55,1000,2,12,500\n1,1,2026-05-14 23:30,90,55,1000,2,12,500\n2,1,31/02/2026 12:00,80,55,1000,2,12,500\n9223372036854775808,1,2026-05-14 23:30,80,55,1000,2,12,500')
  assert.equal(result.received,4);assert.equal(result.valid,1);assert.equal(result.duplicates,1);assert.equal(result.invalid,2)
})

test("análise e prévia não gravam leituras; confirmação valida a prévia e cria um único job",async()=>{
  const id=crypto.randomUUID(),content=JSON.stringify({readings:[reading(),reading(),{...reading(1900000002),timestamp:"2026-02-30T12:00:00Z"}]})
  await prisma.chatFile.create({data:{id,name:"fixture-chat.json",mediaType:"application/json",size:content.length,content}})
  let key:string|undefined,jobId:string|undefined
  const before=await prisma.telemetry.count()
  try{
    const preview=await prepareAttachmentImport(id)
    assert.equal(preview.received,3);assert.equal(preview.valid,1);assert.equal(preview.duplicates,1);assert.equal(preview.invalid,1);assert.equal(preview.sample[0].temperature,78.4)
    const analysis=await executeAgentTool("analyze_uploaded_telemetry",{file_id:id})
    assert.equal(analysis.summary?.leituras_validas,1);assert.equal(analysis.summary?.temperatura_media_c,78.4);assert.equal(analysis.series?.[0].desktop,78.4)
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
  const id=crypto.randomUUID(),content=JSON.stringify(Array.from({length:250},(_,index)=>({...reading(index+1),timestamp:new Date(Date.UTC(2025,0,index+1)).toISOString(),temperature:80})))
  await prisma.chatFile.create({data:{id,name:"fixture-series.json",mediaType:"application/json",size:content.length,content}})
  try{
    const result=await executeAgentTool("analyze_uploaded_telemetry",{file_id:id})
    assert.equal(result.summary?.leituras_validas,250);assert.equal(result.summary?.temperatura_media_c,80)
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
