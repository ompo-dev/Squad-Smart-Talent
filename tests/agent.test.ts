import { test } from "node:test"
import assert from "node:assert/strict"
import { createParser } from "@openuidev/lang-core"
import { analysisSpec } from "../lib/openui-schema"
import { executeAgentTool, readQuery,pool } from "../lib/agent-tools"
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
  await assert.rejects(readQuery("UPDATE telemetry SET temp_motor_c = 0 WHERE false"), (error:unknown) => (error as {code:string}).code === "25006")
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
  const inserted=await pool.query("INSERT INTO telemetry SELECT $1,id_maquina,data_hora,70,pressao_oleo_psi,rpm,vibracao_mm_s,consumo_l_h,horas_motor FROM telemetry ORDER BY id_leitura LIMIT 1 ON CONFLICT DO NOTHING RETURNING id_leitura",[id])
  assert.equal(inserted.rowCount,1)
  try {
    const proposal=await proposeChange({reading_id:id,field:"temp_motor_c",value:71,reason:"Teste automatizado em registro isolado"})
    const before=await readQuery("SELECT temp_motor_c::float AS value FROM telemetry WHERE id_leitura=$1",[id]);assert.equal(before[0].value,70)
    await applyChange(proposal.change.id)
    const after=await readQuery("SELECT temp_motor_c::float AS value FROM telemetry WHERE id_leitura=$1",[id]);assert.equal(after[0].value,71)
    assert.equal((await applyChange(proposal.change.id)).status,"applied")
    const stale=await proposeChange({reading_id:id,field:"temp_motor_c",value:72,reason:"Teste de conflito"})
    await pool.query("UPDATE telemetry SET temp_motor_c=73 WHERE id_leitura=$1",[id])
    await assert.rejects(applyChange(stale.change.id),/registro mudou/)
    await assert.rejects(proposeChange({reading_id:id,field:"id_maquina",value:1,reason:"Campo proibido"}))
    await assert.rejects(proposeChange({reading_id:id,field:"rpm",value:-1,reason:"Valor inválido"}))
  } finally {await pool.query("DELETE FROM telemetry_changes WHERE reading_id=$1",[id]);await pool.query("DELETE FROM telemetry WHERE id_leitura=$1",[id])}
})

test("conversas independentes preservam suas próprias mensagens",async()=>{
  const first=await createThread({id:crypto.randomUUID(),role:"user",content:"Teste conversa A"}),second=await createThread({id:crypto.randomUUID(),role:"user",content:"Teste conversa B"})
  try {
    await saveMessages(first.id,[{id:"a",role:"user",content:"Mensagem só de A"},{id:"b",role:"assistant",content:"Resposta só de A"}])
    assert.equal((await getMessages(first.id)).length,2)
    assert.equal((await getMessages(second.id))[0].content,"Teste conversa B")
    assert.ok((await listThreads()).some(thread=>thread.id===first.id))
  } finally {await pool.query("DELETE FROM chat_threads WHERE id=ANY($1::uuid[])",[[first.id,second.id]])}
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
