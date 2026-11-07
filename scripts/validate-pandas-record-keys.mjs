/**
 * Confere, em JavaScript/Node, se os record_key exportados pelo pipeline
 * Python correspondem ao SHA-256 de JSON.stringify do contrato TypeScript.
 * Execute depois de gerar telemetry_clean.csv.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(value => value !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  const headers = rows.shift() ?? []
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

const file = resolve(process.argv[2] ?? 'reports/pandas/telemetry_clean.csv')
const csv = readFileSync(file, 'utf8')
const rows = parseCsv(csv.replace(/^\uFEFF/, ''))
const sensors = [
  'hydraulic_pressure_bar', 'coolant_pressure_bar', 'air_system_pressure_bar',
  'coolant_temperature_c', 'hydraulic_oil_temperature_c', 'spindle_bearing_temperature_c',
  'spindle_vibration_um', 'tool_vibration_um', 'spindle_speed_rpm', 'voltage_v',
  'torque_nm', 'cutting_kn',
]
let mismatches = 0
const examples = []
for (const [index, row] of rows.entries()) {
  const values = [row.date, row.machine_id, row.assembly_line]
  for (const sensor of sensors) {
    const raw = row[sensor]
    values.push(raw === '' || raw === undefined ? null : Number(raw))
  }
  const rawDowntime = row.downtime
  values.push(rawDowntime === '' || rawDowntime === undefined ? null : rawDowntime === 'True' || rawDowntime === 'true')
  const expected = createHash('sha256').update(JSON.stringify(values), 'utf8').digest('hex').slice(0, 32)
  if (expected !== row.record_key) {
    mismatches++
    if (examples.length < 5) examples.push({ line: index + 2, exported: row.record_key, recomputed: expected })
  }
}
console.log(JSON.stringify({ file, checked: rows.length, mismatches, examples }, null, 2))
if (mismatches > 0) process.exitCode = 1
