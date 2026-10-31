import {prisma} from "@/lib/prisma"
import {jsonValue} from "@/lib/application/command-bus"
import {withSpan} from "@/lib/observability/server"
import {cachedTelemetryView} from "@/lib/cache/telemetry-cache"
import {criticalAlertSql,evaluateReading,formatValue,valuesFromRow} from "@/lib/telemetry-schema"

export const telemetryLabels = {
  header: "Máquina", type: "Linha", status: "Condição", target: "Temp. refrig. °C",
  limit: "Vib. spindle µm", reviewer: "Data da leitura",
}

type Stats = {readings:number;machines:number;temperature:number|null;alerts:number}

async function loadTelemetryView(mode: "latest" | "alerts" | "readings" = "latest") {
  const select = mode === "latest"
    ? "SELECT DISTINCT ON (machine_id) * FROM telemetry ORDER BY machine_id, date DESC"
    : `SELECT * FROM telemetry ${mode === "alerts" ? `WHERE ${criticalAlertSql}` : ""} ORDER BY date DESC LIMIT 200`
  const [records, daily, stats] = await withSpan("telemetry.query","postgres",()=>prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY")
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'")
    const queries = [
      select,
      "SELECT to_char(date, 'YYYY-MM-DD') AS date, ROUND(AVG(coolant_temperature_c), 1)::float AS desktop, MAX(coolant_temperature_c)::float AS mobile FROM telemetry WHERE coolant_temperature_c IS NOT NULL GROUP BY 1 ORDER BY 1",
      `SELECT COUNT(*)::int AS readings, COUNT(DISTINCT machine_id)::int AS machines, ROUND(AVG(coolant_temperature_c), 1)::float AS temperature, COUNT(*) FILTER (WHERE ${criticalAlertSql})::int AS alerts FROM telemetry`,
    ]
    const result: Record<string,unknown>[][] = []
    for (const query of queries) result.push(jsonValue(await tx.$queryRawUnsafe(query)) as Record<string,unknown>[])
    return result
  },{isolationLevel:"RepeatableRead",timeout:18000}),{operation:"telemetry.query"})
  const series = (daily as {date:string;desktop:number|null;mobile:number|null}[])
    .filter((point): point is {date:string;desktop:number;mobile:number} => point.desktop !== null && point.mobile !== null)
  return {
    stats: stats[0] as Stats,
    series,
    rows: records.map((record) => {
      const row = record as Record<string,unknown>
      const status = evaluateReading(valuesFromRow(row), row.downtime === null ? null : Boolean(row.downtime)).status
      const coolant = row.coolant_temperature_c === null ? null : Number(row.coolant_temperature_c)
      const vibration = row.spindle_vibration_um === null ? null : Number(row.spindle_vibration_um)
      return {
        id: Number(row.id), header: String(row.machine_id),
        type: String(row.assembly_line),
        status,
        target: formatValue(coolant, "°C"),
        limit: formatValue(vibration, "µm"),
        reviewer: new Date(String(row.date)).toLocaleDateString("pt-BR", { timeZone: "UTC", dateStyle: "short" }),
      }
    }),
  }
}
export function getTelemetryView(mode:"latest"|"alerts"|"readings"="latest"){return cachedTelemetryView(mode,()=>loadTelemetryView(mode))}
