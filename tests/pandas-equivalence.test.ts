import assert from "node:assert/strict"
import {execFileSync} from "node:child_process"
import {mkdtempSync, readFileSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join, resolve} from "node:path"
import {fileURLToPath} from "node:url"
import {test} from "node:test"
import {parseTelemetry} from "../lib/application/import-telemetry"
import {sensorDefinitions} from "../lib/telemetry-schema"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const fixture = join(root, "tests/fixtures/pipeline-known-cases.csv")

function nullableNumber(value: string | undefined) {
  return value === undefined || value === "" ? null : Number(value)
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = [], field = "", quoted = false
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index++ }
      else if (character === '"') quoted = false
      else field += character
    } else if (character === '"') quoted = true
    else if (character === ",") { row.push(field); field = "" }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index++
      row.push(field); field = ""
      if (row.some(value => value !== "")) rows.push(row)
      row = []
    } else field += character
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row) }
  const headers = rows.shift() ?? []
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))) as Record<string, string>[]
}

test("Pandas and the application parser agree on the documented edge-case fixture", () => {
  const output = mkdtempSync(join(tmpdir(), "telemetry-pandas-"))
  try {
    execFileSync(process.env.PYTHON ?? "python3", ["python/pipeline.py", "--input", fixture, "--output", output], {cwd: root, stdio: "pipe"})
    const python = JSON.parse(readFileSync(join(output, "quality_report.json"), "utf8"))
    const exported = parseCsv(readFileSync(join(output, "telemetry_clean.csv"), "utf8").replace(/^\uFEFF/, ""))
    const application = parseTelemetry(readFileSync(fixture, "utf8"))

    assert.deepEqual(
      {received: python.received, valid: python.valid, duplicates: python.duplicates, invalid: python.invalid},
      {received: application.received, valid: application.valid, duplicates: application.duplicates, invalid: application.invalid},
    )
    assert.deepEqual(
      {missingCells: python.missingCells, zeroCells: python.zeroCells, negativeCells: python.negativeCells, outOfRangeCells: python.outOfRangeCells, missingLabels: python.missingLabels, rowsWithoutSensors: python.rowsWithoutSensors},
      {missingCells: application.quality.missingCells, zeroCells: application.quality.zeroCells, negativeCells: application.quality.negativeCells, outOfRangeCells: application.quality.outOfRangeCells, missingLabels: application.quality.missingLabels, rowsWithoutSensors: application.quality.rowsWithoutSensors},
    )

    const byKey = new Map(application.readings.map(reading => [reading.recordKey, reading]))
    assert.equal(exported.length, byKey.size)
    for (const row of exported) {
      const reading = byKey.get(row.record_key)
      assert.ok(reading, `record_key ${row.record_key} deve ser igual nos dois tratamentos`)
      assert.equal(row.date, reading.timestamp.toISOString())
      assert.equal(row.machine_id, reading.machineId)
      assert.equal(row.assembly_line, reading.assemblyLine)
      assert.equal(row.downtime === "" ? null : row.downtime === "True", reading.downtime)
      assert.equal(row.quality_issues, reading.qualityIssues.join(" | "))
      for (const sensor of sensorDefinitions) assert.equal(nullableNumber(row[sensor.column]), reading[sensor.key])
    }
  } finally {
    rmSync(output, {recursive: true, force: true})
  }
})
