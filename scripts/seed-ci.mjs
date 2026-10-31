import pg from "pg"
import { ciReadings, ciFixture } from "./ci-fixture.mjs"

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
  const columns = Object.keys(readings[0])
  for (let offset = 0; offset < readings.length; offset += 500) {
    const batch = readings.slice(offset, offset + 500)
    const placeholders = batch.map((_, row) => `(${columns.map((__, col) => `$${row * columns.length + col + 1}`).join(",")})`).join(",")
    const values = batch.flatMap(reading => columns.map(column => reading[column]))
    await client.query(`INSERT INTO telemetry (${columns.join(",")}) VALUES ${placeholders}`, values)
  }
  await client.query("COMMIT")
  console.log(`CI fixture: ${ciFixture.readings} synthetic readings, ${ciFixture.machines} machines, ${ciFixture.days} days`)
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  await client.end()
}
