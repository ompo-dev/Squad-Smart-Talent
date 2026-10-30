import { test,after } from "node:test"
import assert from "node:assert/strict"
import { createParser } from "@openuidev/lang-core"
import { analysisSpec } from "../lib/openui-schema"
import { executeAgentTool, readQuery } from "../lib/agent-tools"
import {prisma} from "../lib/prisma"
import {executeCommand,CommandConflict} from "../lib/application/command-bus"
import {importTelemetry,sensorNumber,telemetryDate} from "../lib/application/import-telemetry"
import {claimChatRun,finishChatRun,replayChatRun} from "../lib/application/chat-runs"
import {useCommandStore} from "../lib/stores/command-store"
import axios from "axios"
import {safeAttributes,traceIdentity} from "../lib/observability/context"
import {withRequestTrace,withSpan} from "../lib/observability/server"
import {redisConnection,closeRedis} from "../lib/cache/redis"
import {redisReadThrough} from "../lib/cache/telemetry-cache"
import {authReadiness,getAuth} from "../lib/auth"
import {tracedChatFetch} from "../lib/client/traced-chat-fetch"
import {useTraceStore} from "../lib/stores/trace-store"
process.env.OBSERVABILITY_LOGS="off"
after(async()=>{await closeRedis();await prisma.$disconnect()})
import {proposeChange,applyChange} from "../lib/telemetry-edits"
import {createThread,getMessages,saveMessages,listThreads} from "../lib/chat-db"
import { POST } from "../app/api/ai/route"

test("filtros de telemetria são reais, validados e limitados", async () => {
  const result = await executeAgentTool("query_telemetry", {machine_id:22,min_temperature:100,order_by:"temp_motor_c",limit:5})
  assert.ok(result.rows?.length)
  assert.ok(result.rows.every((row) => row.id_maquina === 22 && Number(row.temp_motor_c) >= 100))
  assert.ok(result.rows.length <= 5)
  await assert.rejects(executeAgentTool("query_telemetry",{limit:201}))
  await assert.rejects(executeAgentTool("query_telemetry",{order_by:"data_hora; DROP TABLE telemetry"}))
  await assert.rejects(executeAgentTool("execute_shell",{}))
})
test("resumo e agregação usam o arquivo importado", async () => {
  const result = await executeAgentTool("get_fleet_summary",{})
  assert.equal(result.summary?.maquinas,24); assert.equal(result.summary?.leituras,4000)
  const grouped = await executeAgentTool("aggregate_telemetry",{group_by:"day",metric:"temperature"})
  assert.equal(grouped.series?.length,14)
  assert.ok(grouped.series?.every((row) => row.mobile >= row.desktop))
  await assert.rejects(readQuery("UPDATE telemetry SET temp_motor_c = 0 WHERE false"), (error:unknown) => JSON.stringify(error).includes("25006")||String(error).includes("read-only"))
})
test("agente executa tool call, devolve dados ao modelo e valida OpenUI", async () => {
  const previousFetch = globalThis.fetch; const previousKey = process.env.DEEPSEEK_API_KEY; process.env.DEEPSEEK_API_KEY = "test-only"
  let count = 0
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)); count++
    if (count === 1) { assert.equal(body.tool_choice,"required"); return Response.json({choices:[{message:{role:"assistant",content:null,tool_calls:[{id:"test_rows",type:"function",function:{name:"query_telemetry",arguments:JSON.stringify({machine_id:22,limit:2})}}]}}]}) }
    const result = body.messages.find((message:{role:string}) => message.role === "tool")
    assert.ok(result); assert.equal(JSON.parse(result.content).rows[0].id_maquina,22)
    return Response.json({choices:[{message:{role:"assistant",content:'root = Analysis("Máquina 22", "Consultei a base.", [table])\ntable = DataResult("test_rows", "Leituras da máquina")'}}]})
  }
  try {
    const response = await POST(new Request("http://localhost/api/ai",{method:"POST",body:JSON.stringify({question:"Analise a máquina 22",stream:true})}))
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line))
    assert.ok(events.some((event) => event.type === "tool_start")); assert.ok(events.some((event) => event.type === "tool_result"))
    const answer = events.find((event) => event.type === "answer"); assert.ok(answer); assert.equal(answer.format,"openui")
    const parsed = createParser(analysisSpec.toJSONSchema(),"Analysis").parse(answer.content)
    assert.ok(parsed.root); assert.equal(parsed.meta.errors.length,0); assert.equal(count,2)
  } finally { globalThis.fetch=previousFetch; if(previousKey === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY=previousKey }
})
test("falhas de autenticação do provedor são explícitas", async () => {
  const previousFetch=globalThis.fetch; const previousKey=process.env.DEEPSEEK_API_KEY; process.env.DEEPSEEK_API_KEY="test-only"
  globalThis.fetch=async () => new Response(null,{status:401})
  try { const response=await POST(new Request("http://localhost/api/ai",{method:"POST",body:JSON.stringify({question:"Resumo"})})); assert.equal(response.status,502); assert.match((await response.json()).error,/recusou a chave/) }
  finally { globalThis.fetch=previousFetch; if(previousKey === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY=previousKey }
})

test("alertas usam critérios fixos sobre toda a base",async()=>{
  const alerts=await executeAgentTool("get_alerts",{}),summary=await executeAgentTool("get_fleet_summary",{})
  assert.equal(alerts.summary?.leituras_em_alerta,summary.summary?.leituras_em_alerta)
  assert.ok(alerts.rows?.every(row=>Number(row.temp_motor_c)>100||Number(row.vibracao_mm_s)>4.5))
})

test("edição exige proposta, confirma um registro e detecta conflito",async()=>{
  const id=1900000000+Math.floor(Math.random()*10000000)
  const inserted=await prisma.$queryRawUnsafe<unknown[]>("INSERT INTO telemetry SELECT $1,id_maquina,data_hora,70,pressao_oleo_psi,rpm,vibracao_mm_s,consumo_l_h,horas_motor FROM telemetry ORDER BY id_leitura LIMIT 1 ON CONFLICT DO NOTHING RETURNING id_leitura",id)
  assert.equal(inserted.length,1)
  try {
    const proposal=await proposeChange({reading_id:id,field:"temp_motor_c",value:71,reason:"Teste automatizado em registro isolado"})
    const before=await readQuery("SELECT temp_motor_c::float AS value FROM telemetry WHERE id_leitura=$1",[id]);assert.equal(before[0].value,70)
    await applyChange(proposal.change.id)
    const after=await readQuery("SELECT temp_motor_c::float AS value FROM telemetry WHERE id_leitura=$1",[id]);assert.equal(after[0].value,71)
    assert.equal((await applyChange(proposal.change.id)).status,"applied")
    const stale=await proposeChange({reading_id:id,field:"temp_motor_c",value:72,reason:"Teste de conflito"})
    await prisma.telemetry.update({where:{id:BigInt(id)},data:{temperature:73}})
    await assert.rejects(applyChange(stale.change.id),/registro mudou/)
    await assert.rejects(proposeChange({reading_id:id,field:"id_maquina",value:1,reason:"Campo proibido"}))
    await assert.rejects(proposeChange({reading_id:id,field:"rpm",value:-1,reason:"Valor inválido"}))
  } finally {await prisma.telemetryChange.deleteMany({where:{readingId:id}});await prisma.telemetry.delete({where:{id:BigInt(id)}});await prisma.commandReceipt.deleteMany({where:{OR:[{result:{path:["change","readingId"],equals:id}},{result:{path:["readingId"],equals:id}}]}})}
})

test("conversas independentes preservam suas próprias mensagens",async()=>{
  const first=await createThread({id:crypto.randomUUID(),role:"user",content:"Teste conversa A"}),second=await createThread({id:crypto.randomUUID(),role:"user",content:"Teste conversa B"})
  try {
    await saveMessages(first.id,[{id:"a",role:"user",content:"Mensagem só de A"},{id:"b",role:"assistant",content:"Resposta só de A"}])
    assert.equal((await getMessages(first.id)).length,2)
    assert.equal((await getMessages(second.id))[0].content,"Teste conversa B")
    assert.ok((await listThreads()).some(thread=>thread.id===first.id))
  } finally {await prisma.chatThread.deleteMany({where:{id:{in:[first.id,second.id]}}})}
})

test("primeiro trecho chega antes de o provedor concluir a geração",async()=>{
  const previousFetch=globalThis.fetch,previousKey=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY="test-only"
  let count=0,finished=false,release!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve}),encoder=new TextEncoder()
  const encode=(delta:unknown)=>encoder.encode(`data: ${JSON.stringify({choices:[{delta}]})}\n\n`)
  globalThis.fetch=async()=>{
    if(++count===1)return Response.json({choices:[{message:{role:"assistant",content:null,tool_calls:[{id:"stream_summary",type:"function",function:{name:"get_fleet_summary",arguments:"{}"}}]}}]})
    return new Response(new ReadableStream({async start(controller){controller.enqueue(encode({content:'root = Analysis("Resumo", "'}));await gate;controller.enqueue(encode({content:'Consultei a base.", [])'}));finished=true;controller.close()}}),{headers:{"Content-Type":"text/event-stream"}})
  }
  try {
    const response=await POST(new Request("http://localhost/api/ai",{method:"POST",body:JSON.stringify({question:"Resumo",stream:true})})),reader=response.body!.getReader(),decoder=new TextDecoder()
    let received=""
    while(!received.includes('"type":"answer_delta"')){const chunk=await reader.read();assert.equal(chunk.done,false);received+=decoder.decode(chunk.value)}
    assert.equal(finished,false);release()
    while(true){const chunk=await reader.read();if(chunk.done)break;received+=decoder.decode(chunk.value)}
    assert.equal(finished,true);assert.match(received,/"type":"answer"/)
  } finally {release();globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previousKey}
})

test("comandos concorrentes com a mesma chave executam uma única vez",async()=>{
 const key=crypto.randomUUID();let executions=0
 const command={type:"test.once",idempotencyKey:key,payload:{value:1}}
 try {
   const results=await Promise.all(Array.from({length:10},()=>executeCommand(command,async()=>{executions++;return {id:crypto.randomUUID()}})))
   assert.equal(executions,1);assert.ok(results.every(result=>result.id===results[0].id))
   await assert.rejects(executeCommand({...command,payload:{value:2}},async()=>({id:"should-not-run"})),CommandConflict)
 }finally{await prisma.commandReceipt.deleteMany({where:{id:`test.once:${key}`}})}
})

test("ingestão TypeScript normaliza e não sobrescreve registros editados",async()=>{
 assert.equal(sensorNumber("78,4"),78.4);assert.equal(sensorNumber("-999"),null);assert.equal(sensorNumber("NaN"),null);assert.equal(sensorNumber(-10,true),null)
 assert.equal(telemetryDate("14/05/2026 23:30").toISOString(),"2026-05-14T23:30:00.000Z");assert.throws(()=>telemetryDate("31/02/2026 10:00"))
 const id=2000000000+Math.floor(Math.random()*1000000),key=crypto.randomUUID()
 const csv=`id_leitura,id_maquina,data_hora,temp_motor_c,pressao_oleo_psi,rpm,vibracao_mm_s,consumo_l_h,horas_motor\n${id},1,14/05/2026 23:30,"78,4",55,-999,NaN,2,50\n${id},1,14/05/2026 23:30,90,55,800,2,2,50\n${id+1},2,2026-05-14 23:30:00,80,55,900,2,2,50\n${id+2},3,data-invalida,80,55,900,2,2,50`
 try {
   const result=await importTelemetry(csv,key);assert.equal(result.inserted,2);assert.equal(result.duplicates,1);assert.equal(result.invalid,1)
   const row=await prisma.telemetry.findUniqueOrThrow({where:{id:BigInt(id)}});assert.equal(row.temperature?.toNumber(),78.4);assert.equal(row.rpm,null);assert.equal(row.vibration,null)
   await prisma.telemetry.update({where:{id:BigInt(id)},data:{temperature:85}})
   assert.deepEqual(await importTelemetry(csv,key),result)
   await importTelemetry(csv,`${key}-again`)
   assert.equal((await prisma.telemetry.findUniqueOrThrow({where:{id:BigInt(id)}})).temperature?.toNumber(),85)
 }finally{await prisma.telemetry.deleteMany({where:{id:{in:[BigInt(id),BigInt(id+1)]}}});await prisma.commandReceipt.deleteMany({where:{id:{in:[`telemetry.import-csv:${key}`,`telemetry.import-csv:${key}-again`]}}})}
})

test("reenvio da mesma mensagem reutiliza a execução salva",async()=>{
 const user={id:crypto.randomUUID(),role:"user" as const,content:"Teste de repetição"},thread=await createThread(user)
 try {
   assert.equal((await claimChatRun(user.id,thread.id,user.content)).kind,"new")
   assert.equal((await claimChatRun(user.id,thread.id,user.content)).kind,"running")
   const answer={id:crypto.randomUUID(),role:"assistant" as const,content:"Resultado salvo"}
   await finishChatRun(user.id,thread.id,[user,answer],[answer])
   const replay=await claimChatRun(user.id,thread.id,user.content);assert.equal(replay.kind,"replay");assert.equal(replay.messages[0].content,"Resultado salvo")
   const response=replayChatRun(thread.id,replay.messages),events=(await response.text()).trim().split("\n\n").map(line=>JSON.parse(line.slice(6)))
   assert.equal(response.headers.get("Idempotency-Replayed"),"true");assert.equal(events[0].runId,events.at(-1).runId)
   await assert.rejects(claimChatRun(user.id,thread.id,"Outro conteúdo"),CommandConflict)
 }finally{await prisma.chatRun.deleteMany({where:{id:user.id}});await prisma.chatThread.deleteMany({where:{id:thread.id}})}
})

test("Zustand aplica estado otimista, reverte falha e reaproveita a chave no retry",async()=>{
 const previous=axios.post,id=crypto.randomUUID();let reject!:(reason:unknown)=>void
 axios.post=(()=>new Promise((_,fail)=>{reject=fail})) as typeof axios.post
 try {
   useCommandStore.getState().hydrate(id,"pending")
   const pending=useCommandStore.getState().confirmChange(id,71),optimistic=useCommandStore.getState().entries[id]
   assert.equal(optimistic.status,"applied");assert.equal(optimistic.pending,true);assert.equal(optimistic.optimisticValue,71)
   reject(new Error("falha simulada"));await pending
   const rollback=useCommandStore.getState().entries[id];assert.equal(rollback.status,"pending");assert.equal(rollback.pending,false);assert.ok(rollback.error)
   axios.post=((_url,_body,options)=>{assert.equal(options?.headers?.["Idempotency-Key"],optimistic.requestId);return Promise.resolve({data:{status:"applied"}})}) as typeof axios.post
   await useCommandStore.getState().confirmChange(id,71);assert.equal(useCommandStore.getState().entries[id].status,"applied")
 }finally{axios.post=previous;useCommandStore.setState({entries:{}})}
})

test("rastreamento preserva traceparent e relaciona a falha sem vazar payload",async()=>{
 const traceId=crypto.randomUUID().replaceAll("-",""),parentId="1111111111111111",key=crypto.randomUUID()
 try {
   const response=await withRequestTrace(new Request("http://localhost/api/test",{headers:{traceparent:`00-${traceId}-${parentId}-01`}}),"POST /api/test",async()=>{
     await executeCommand({type:"test.failed",idempotencyKey:key,payload:{password:"never-record-this",prompt:"private-text"}},async()=>{throw new Error("never-record-this")})
     return Response.json({ok:true})
   })
   assert.equal(response.status,500);assert.equal(response.headers.get("X-Trace-Id"),traceId)
   const events=await prisma.traceEvent.findMany({where:{traceId}})
   const root=events.find(event=>event.name==="POST /api/test"),command=events.find(event=>event.name==="command.dispatch")
   assert.equal(root?.parentSpanId,parentId);assert.equal(command?.parentSpanId,root?.spanId);assert.equal(command?.status,"error")
   assert.ok(!JSON.stringify(events).includes("never-record-this"));assert.ok(!JSON.stringify(events).includes("private-text"))
   assert.equal(await prisma.commandReceipt.count({where:{id:`test.failed:${key}`}}),0)
   assert.deepEqual(safeAttributes({password:"secret",cookie:"secret",operation:"test",count:2}),{operation:"test",count:2})
   assert.equal(traceIdentity("00-00000000000000000000000000000000-1111111111111111-01"),undefined)
 }finally{await prisma.traceEvent.deleteMany({where:{traceId}})}
})

test("Redis real reutiliza a leitura e mudança de revisão cria outra chave",async(context)=>{
 const redis=await redisConnection();if(!redis){context.skip("REDIS_URL não configurado");return}
 const key=`test:cache:${crypto.randomUUID()}`;let loads=0
 try {
   const load=async()=>({value:++loads})
   assert.deepEqual(await redisReadThrough(`${key}:0`,load),{value:1})
   assert.deepEqual(await redisReadThrough(`${key}:0`,load),{value:1});assert.equal(loads,1)
   assert.deepEqual(await redisReadThrough(`${key}:1`,load),{value:2});assert.equal(loads,2)
 }finally{await redis.del([`${key}:0`,`${key}:1`])}
 const previousUrl=process.env.REDIS_URL
 await closeRedis();process.env.REDIS_URL="redis://127.0.0.1:1"
 try{assert.deepEqual(await redisReadThrough(`${key}:unavailable`,async()=>({fresh:true})),{fresh:true})}
 finally{await closeRedis();process.env.REDIS_URL=previousUrl}
})

test("Google permanece inativo sem credenciais e segredo",()=>{
 const previous={secret:process.env.BETTER_AUTH_SECRET,id:process.env.GOOGLE_CLIENT_ID,client:process.env.GOOGLE_CLIENT_SECRET}
 delete process.env.BETTER_AUTH_SECRET;delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET
 try{assert.equal(authReadiness().enabled,false);assert.equal(getAuth(),null)}finally{for(const [name,value] of [["BETTER_AUTH_SECRET",previous.secret],["GOOGLE_CLIENT_ID",previous.id],["GOOGLE_CLIENT_SECRET",previous.client]]){if(value===undefined)delete process.env[name!];else process.env[name!]=value}}
})

test("instrumentação do cliente preserva streaming sem esperar o texto completo",async()=>{
 const previous=globalThis.fetch,encoder=new TextEncoder(),userId=crypto.randomUUID();let release!:()=>void,ended=false
 const gate=new Promise<void>(resolve=>{release=resolve})
 globalThis.fetch=async(input)=>{
   if(String(input).includes("observability/events"))return Response.json({accepted:1},{status:202})
   return new Response(new ReadableStream({async start(controller){controller.enqueue(encoder.encode("primeiro trecho"));await gate;controller.enqueue(encoder.encode(" último trecho"));ended=true;controller.close()}}))
 }
 try{
   const response=await tracedChatFetch("/api/chat",{method:"POST",body:JSON.stringify({messages:[{id:userId,role:"user",content:"privado"}]})}),reader=response.body!.getReader()
   const first=await reader.read();assert.equal(new TextDecoder().decode(first.value),"primeiro trecho");assert.equal(ended,false)
   release();while(!(await reader.read()).done){/* consume remaining chunks */}
   assert.equal(ended,true);assert.ok(useTraceStore.getState().parents[userId])
 }finally{release();globalThis.fetch=previous;useTraceStore.setState({parents:{}})}
})

test("especificação acadêmica entrega as 5 consultas SQLite sem SELECT * e o modelo relacional ER", async () => {
  const result = await executeAgentTool("get_theme_academic_spec", { topic: "all" })
  const spec = result.academicSpec as { tema: string; consultas: { sql: string }[]; modelo: { mermaidDiagram: string }; checklist: { itens_obrigatorios: unknown[] } }
  assert.equal(spec.tema, "Manufatura e Eficiência (OEE)")
  assert.equal(spec.consultas?.length, 5)
  assert.ok(spec.consultas?.every((q) => !q.sql.includes("SELECT *")))
  assert.ok(spec.modelo?.mermaidDiagram?.includes("erDiagram"))
  assert.ok(spec.checklist?.itens_obrigatorios?.length >= 4)
})
