import {sensorDefinitions,type SensorKey} from "@/lib/telemetry-schema"
import type {TelemetryRow} from "@/lib/types"

/**
 * Same criteria as queries 2 and 5 of docs/entrega-aula-1 and src/graficos.py.
 * Only temperature, vibration and pressure count as alerts here, so the ranking
 * matches those tables; tests/maintenance-report.test.ts checks the numbers.
 */
const alertGroups: SensorKey[][] = [
  ["coolantTemperature","hydraulicOilTemperature","spindleBearingTemperature"],
  ["spindleVibration","toolVibration"],
  ["hydraulicPressure","coolantPressure","airSystemPressure"],
]
export const criticalTemperatureC = 45
// shortcut: fixed cut as in query 5, review together with the query when new data arrives.
const periodCut = Date.UTC(2022,2,26)

export type LineReport = {line:string;readings:number;analyzed:number;failures:number;ratePct:number|null;marginMin:number|null;marginMax:number|null}
export type MachineReport = {
  machine:string;points:number;priority:"Alta"|"Média"|"Baixa";tied:boolean;readings:number;alerts:number
  alertsPer100:number;incompletePct:number;maxTemperature:number|null;criticalTemperatureReadings:number
  alertsPer100Before:number|null;alertsPer100After:number|null
  criteria:{alerts:boolean;incomplete:boolean;temperature:boolean;trend:boolean}
}
export type MaintenanceReportData = {
  lines:LineReport[];machines:MachineReport[];lineTitle:string;lineNote:string;priorityTitle:string;temperatureNote:string|null
  fleetFailurePct:number|null;fleetAlertsPer100:number;fleetIncompletePct:number
}

const round = (value:number,places=2) => Math.round((value+Number.EPSILON)*10**places)/10**places
const average = (values:number[]) => values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : null
const list = (names:string[]) => names.length===1 ? names[0] : `${names.slice(0,-1).join(", ")} e ${names[names.length-1]}`
export const decimal = (value:number,digits=2) => value.toLocaleString("pt-BR",{minimumFractionDigits:digits,maximumFractionDigits:digits})

function isCritical(row:TelemetryRow,key:SensorKey) {
  const value=row[key],thresholds=sensorDefinitions.find(definition=>definition.key===key)?.thresholds
  if(value===null||!thresholds)return false
  return (thresholds.critLow!==undefined&&value<thresholds.critLow)||(thresholds.critHigh!==undefined&&value>thresholds.critHigh)
}
const alertCount = (row:TelemetryRow) => (row.downtime===true?1:0)+alertGroups.filter(group=>group.some(key=>isCritical(row,key))).length
const isIncomplete = (row:TelemetryRow) => sensorDefinitions.some(definition=>row[definition.key]===null)

function groupBy(rows:TelemetryRow[],key:"assemblyLine"|"machineId") {
  const groups=new Map<string,TelemetryRow[]>()
  for(const row of rows)groups.set(row[key],[...(groups.get(row[key])??[]),row])
  return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))
}

/** 95% Wilson interval, in percentage points. */
function margin(failures:number,analyzed:number) {
  const z=1.96,rate=failures/analyzed,divisor=1+z**2/analyzed
  const center=(rate+z**2/(2*analyzed))/divisor,half=z*Math.sqrt(rate*(1-rate)/analyzed+z**2/(4*analyzed**2))/divisor
  return [round(100*(center-half)),round(100*(center+half))]
}

function lineReports(rows:TelemetryRow[]):LineReport[] {
  return groupBy(rows,"assemblyLine").map(([line,group])=>{
    const analyzed=group.filter(row=>row.downtime!==null).length,failures=group.filter(row=>row.downtime===true).length
    const [marginMin,marginMax]=analyzed?margin(failures,analyzed):[null,null]
    return {line,readings:group.length,analyzed,failures,ratePct:analyzed?round(100*failures/analyzed):null,marginMin,marginMax}
  }).sort((a,b)=>(b.ratePct??-1)-(a.ratePct??-1)||a.line.localeCompare(b.line))
}

function machineReports(rows:TelemetryRow[]):MachineReport[] {
  const fleetAlerts=average(rows.map(alertCount))??0,fleetIncomplete=average(rows.map(row=>isIncomplete(row)?1:0))??0
  const machines=groupBy(rows,"machineId").map(([machine,group]):MachineReport=>{
    const alerts=group.map(alertCount),alertRate=average(alerts)??0,incomplete=average(group.map(row=>isIncomplete(row)?1:0))??0
    const temperatures=group.flatMap(row=>row.coolantTemperature===null?[]:[row.coolantTemperature])
    const maxTemperature=temperatures.length?Math.max(...temperatures):null
    const before=average(group.filter(row=>Date.parse(row.timestamp)<periodCut).map(alertCount))
    const after=average(group.filter(row=>Date.parse(row.timestamp)>=periodCut).map(alertCount))
    const criteria={
      alerts:alertRate>fleetAlerts,incomplete:incomplete>fleetIncomplete,
      temperature:maxTemperature!==null&&maxTemperature>=criticalTemperatureC,
      trend:before!==null&&after!==null&&after>before,
    }
    const points=Object.values(criteria).filter(Boolean).length
    return {
      machine,points,priority:points>=3?"Alta":points===2?"Média":"Baixa",tied:false,readings:group.length,
      alerts:alerts.reduce((sum,value)=>sum+value,0),alertsPer100:round(100*alertRate),incompletePct:round(100*incomplete),
      maxTemperature:maxTemperature===null?null:round(maxTemperature,1),
      criticalTemperatureReadings:temperatures.filter(value=>value>=criticalTemperatureC).length,
      alertsPer100Before:before===null?null:round(100*before),alertsPer100After:after===null?null:round(100*after),criteria,
    }
  })
  // Inside a tie the order is alphabetical, so no machine looks like the winner.
  machines.sort((a,b)=>b.points-a.points||a.machine.localeCompare(b.machine))
  const top=machines.filter(machine=>machine.points===machines[0]?.points)
  if(top.length>1)for(const machine of top)machine.tied=true
  return machines
}

function lineTitle(lines:LineReport[]) {
  const top=lines[0]?.ratePct??null
  if(top===null)return "Sem leituras com rótulo de falha para comparar as linhas"
  const leaders=lines.filter(line=>line.ratePct===top).map(line=>line.line)
  return leaders.length===1
    ? `Linha ${leaders[0]} apresenta a maior taxa de falhas: ${decimal(top)}%`
    : `Linhas ${list(leaders)} empatam na maior taxa de falhas: ${decimal(top)}%`
}

function lineNote(lines:LineReport[]) {
  const known=lines.filter(line=>line.ratePct!==null)
  if(known.length<2)return "Só há uma linha com rótulos; não há comparação."
  const high=known[0],low=known[known.length-1]
  const gap=decimal((high.ratePct??0)-(low.ratePct??0))
  return (high.marginMin??0)<=(low.marginMax??0)
    ? `Diferença de ${gap} p.p. entre a maior e a menor taxa. As margens de 95% se sobrepõem: a diferença pode ser acaso.`
    : `Diferença de ${gap} p.p. entre a maior e a menor taxa. As margens de 95% não se sobrepõem.`
}

function priorityTitle(machines:MachineReport[]) {
  const points=machines[0]?.points??0
  if(points===0)return "Nenhuma máquina atende aos critérios de triagem"
  const leaders=machines.filter(machine=>machine.points===points).map(machine=>machine.machine)
  return leaders.length===1
    ? `${leaders[0]} vem primeiro na inspeção: ${points} de 4 critérios`
    : `${list(leaders)} empatam na prioridade de inspeção: ${points} de 4 critérios`
}

function temperatureNote(machines:MachineReport[]) {
  const isolated=machines.filter(machine=>machine.criteria.temperature&&machine.criticalTemperatureReadings===1).map(machine=>machine.machine)
  return isolated.length?`Atenção: em ${list(isolated)}, o critério de temperatura vem de uma única leitura; confira se não é erro de sensor.`:null
}

export function buildMaintenanceReport(rows:TelemetryRow[]):MaintenanceReportData {
  const lines=lineReports(rows),machines=machineReports(rows)
  const labelled=rows.filter(row=>row.downtime!==null)
  return {
    lines,machines,lineTitle:lineTitle(lines),lineNote:lineNote(lines),priorityTitle:priorityTitle(machines),temperatureNote:temperatureNote(machines),
    fleetFailurePct:labelled.length?round(100*labelled.filter(row=>row.downtime===true).length/labelled.length):null,
    fleetAlertsPer100:round(100*(average(rows.map(alertCount))??0)),
    fleetIncompletePct:round(100*(average(rows.map(row=>isIncomplete(row)?1:0))??0)),
  }
}
