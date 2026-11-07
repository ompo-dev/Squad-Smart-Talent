import {test} from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {parseTelemetry} from "../lib/application/import-telemetry"
import {buildMaintenanceReport} from "../lib/maintenance-report"
import {telemetryRowFromRecord} from "../lib/telemetry-row"

const delivery="docs/entrega-aula-1"
const rows=parseTelemetry(readFileSync(`${delivery}/dados/machine_downtime.csv`,"utf8")).readings.map((reading,index)=>telemetryRowFromRecord(reading,index+1))
const table=(name:string)=>{
  const [header,...lines]=readFileSync(`${delivery}/resultados/${name}`,"utf8").trim().split(/\r?\n/).map(line=>line.split(";"))
  return lines.map(line=>Object.fromEntries(header.map((column,index)=>[column,line[index]])))
}
const row=(machineId:string,assemblyLine:string,downtime:boolean|null,coolantTemperature=20)=>telemetryRowFromRecord({
  machineId,assemblyLine,downtime,timestamp:"2022-01-01T00:00:00Z",hydraulicPressure:100,coolantPressure:5,airSystemPressure:6,coolantTemperature,
  hydraulicOilTemperature:40,spindleBearingTemperature:30,spindleVibration:1,toolVibration:20,spindleSpeed:20000,voltage:350,torque:20,cutting:3,
})

test("failure rate by line matches query 2 of the delivered tables",()=>{
  const report=buildMaintenanceReport(rows)
  for(const expected of table("resultado_consulta_2.csv")){
    const line=report.lines.find(item=>item.line===expected.assembly_line)
    assert.ok(line)
    assert.equal(line.readings,Number(expected.leituras))
    assert.equal(line.failures,Number(expected.paradas))
    assert.equal(line.ratePct,Number(expected.taxa_parada_pct))
  }
})

test("inspection priority matches query 5 of the delivered tables",()=>{
  const report=buildMaintenanceReport(rows)
  for(const expected of table("resultado_consulta_5.csv")){
    const machine=report.machines.find(item=>item.machine===expected.machine_id)
    assert.ok(machine)
    assert.equal(machine.points,Number(expected.pontos_prioridade))
    assert.equal(machine.alerts,Number(expected.alertas_criticos))
    assert.equal(machine.alertsPer100,Number(expected.alertas_por_100_leituras))
    assert.equal(machine.incompletePct,Number(expected.leituras_incompletas_pct))
    assert.equal(machine.maxTemperature,Number(expected.temperatura_maxima_c))
    assert.equal(machine.alertsPer100Before,Number(expected.alertas_por_100_sem1))
    assert.equal(machine.alertsPer100After,Number(expected.alertas_por_100_sem2))
    assert.deepEqual([machine.criteria.alerts,machine.criteria.incomplete,machine.criteria.temperature,machine.criteria.trend].map(Number),
      [expected.acima_media_alertas,expected.acima_media_incompletas,expected.atingiu_temperatura_critica,expected.taxa_em_alta].map(Number))
  }
})

test("titles come from the data and ties are shown as ties",()=>{
  const lines=buildMaintenanceReport([row("A","Azul",true),row("A","Azul",false),row("B","Verde",true),row("B","Verde",false)])
  assert.equal(lines.lineTitle,"Linhas Azul e Verde empatam na maior taxa de falhas: 50,00%")
  const single=buildMaintenanceReport([row("A","Azul",true),row("B","Verde",false)])
  assert.equal(single.lineTitle,"Linha Azul apresenta a maior taxa de falhas: 100,00%")
  const machines=buildMaintenanceReport([row("A","L",false,50),row("B","L",false,50),row("C","L",false)])
  assert.equal(machines.priorityTitle,"A e B empatam na prioridade de inspeção: 2 de 4 critérios")
  assert.deepEqual(machines.machines.map(machine=>machine.tied),[true,true,false])
})

test("a temperature criterion from a single reading raises a warning",()=>{
  assert.match(buildMaintenanceReport(rows).temperatureNote??"",/Makino-L2-Unit1-2015/)
  assert.equal(buildMaintenanceReport([row("A","L",false,50),row("A","L",false,50)]).temperatureNote,null)
})

test("missing labels stay out of the rate and an empty base has no leader",()=>{
  const report=buildMaintenanceReport([row("A","Azul",null),row("B","Verde",true)])
  assert.equal(report.lines.find(line=>line.line==="Azul")?.ratePct,null)
  assert.equal(report.lineTitle,"Linha Verde apresenta a maior taxa de falhas: 100,00%")
  const empty=buildMaintenanceReport([])
  assert.equal(empty.fleetFailurePct,null)
  assert.equal(empty.lineTitle,"Sem leituras com rótulo de falha para comparar as linhas")
  assert.equal(empty.priorityTitle,"Nenhuma máquina atende aos critérios de triagem")
})
