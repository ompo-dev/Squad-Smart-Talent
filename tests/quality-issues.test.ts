import {test} from "node:test"
import assert from "node:assert/strict"
import {matchesQuality, parseQualityIssue, qualityCsv, qualityOccurrences, summarizeQuality} from "../lib/quality-issues"
import {telemetryRowFromRecord} from "../lib/telemetry-row"

const row=(machineId:string,qualityIssues:string[],id=1)=>telemetryRowFromRecord({
  machineId,assemblyLine:"L1",timestamp:"2022-01-01T00:00:00Z",downtime:false,qualityIssues,
},id)

test("quality issues keep the recorded sensor and reason",()=>{
  assert.deepEqual(parseQualityIssue("Pressão hidr.: ausente"),{sensor:"Pressão hidr.",reason:"ausente",category:"missing"})
  assert.deepEqual(parseQualityIssue("Parada: rótulo de parada ausente"),{sensor:"Parada",reason:"rótulo de parada ausente",category:"missingLabel"})
  assert.deepEqual(parseQualityIssue("sem sensores"),{sensor:"Leitura",reason:"sem sensores",category:"noSensors"})
  assert.equal(parseQualityIssue("Sensor X: motivo novo").category,null)
})

test("affected readings and occurrences are counted separately",()=>{
  const occurrences=qualityOccurrences([
    row("A",["Pressão hidr.: ausente","Vib. spindle: outlier estatístico"],1),
    row("B",["Temp. refrig.: zero tratado como ausente"],2),
  ])
  assert.deepEqual(summarizeQuality(occurrences),{readings:2,occurrences:3})
})

test("filter matches the recorded category, not sensor values",()=>{
  const reading=row("A",["Vib. spindle: outlier estatístico"])
  assert.equal(matchesQuality(reading,"outlier"),true)
  assert.equal(matchesQuality(reading,"missing"),false)
  assert.equal(matchesQuality(reading,"all"),true)
})

test("csv exports every occurrence of the filtered rows",()=>{
  const csv=qualityCsv([
    row("A",["Pressão hidr.: ausente","Vib. spindle: outlier estatístico"],1),
    row("B",["Sensor X: valor; estranho"],2),
  ])
  const [header,...lines]=csv.split("\r\n")
  assert.equal(header,"leitura_id;record_key;maquina;linha;data;sensor;motivo;categoria")
  assert.equal(lines.length,3)
  assert.match(lines[0],/^1;;A;L1;2022-01-01T00:00:00.000Z;Pressão hidr\.;ausente;ausente$/)
  assert.match(lines[2],/^2;;B;L1;2022-01-01T00:00:00\.000Z;Sensor X;"valor; estranho";"valor; estranho"$/)
})
