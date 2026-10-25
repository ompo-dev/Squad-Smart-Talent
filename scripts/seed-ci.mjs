import pg from "pg"
import { ciReadings } from "./ci-fixture.mjs"

const url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost/invalid")
if (process.env.CI !== "true" || url.pathname !== "/telemetry_ci" || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) {
  throw new Error("CI seed requires CI=true and a disposable local telemetry_ci database")
}
const client = new pg.Client({ connectionString: url.toString() })
await client.connect()
try {
  await client.query("BEGIN")
  const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM telemetry")
  if (rows[0].count !== 0) throw new Error("CI seed refuses to overwrite a nonempty database")
  const readings = ciReadings()
  for (let offset = 0; offset < readings.length; offset += 500) {
    const batch = readings.slice(offset, offset + 500)
    const placeholders = batch.map((_, row) => `(${Array.from({ length: 9 }, (_, col) => `$${row * 9 + col + 1}`).join(",")})`).join(",")
    await client.query(`INSERT INTO telemetry (id_leitura,id_maquina,data_hora,temp_motor_c,pressao_oleo_psi,rpm,vibracao_mm_s,consumo_l_h,horas_motor) VALUES ${placeholders}`, batch.flat())
  }
  await client.query("COMMIT")
  console.log("CI fixture: 4000 synthetic readings, 24 machines, 14 days")
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  await client.end()
}
