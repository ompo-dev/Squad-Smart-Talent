import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 })
export const telemetryLabels = { header: "Máquina", type: "RPM", status: "Condição", target: "Temperatura °C", limit: "Vibração mm/s", reviewer: "Data da leitura" }
export async function getTelemetryView(mode: "latest" | "alerts" | "readings" = "latest") {
  const select = mode === "latest"
    ? "SELECT DISTINCT ON (id_maquina) * FROM telemetry ORDER BY id_maquina, data_hora DESC"
    : `SELECT * FROM telemetry ${mode === "alerts" ? "WHERE temp_motor_c > 100 OR NULLIF(vibracao_mm_s, 'NaN'::numeric) > 4.5" : ""} ORDER BY data_hora DESC LIMIT 200`
  const [records, daily, stats] = await Promise.all([
    pool.query(select),
    pool.query("SELECT to_char(data_hora, 'YYYY-MM-DD') AS date, ROUND(AVG(temp_motor_c), 1)::float AS desktop, MAX(temp_motor_c)::float AS mobile FROM telemetry GROUP BY 1 ORDER BY 1"),
    pool.query("SELECT COUNT(*)::int AS readings, COUNT(DISTINCT id_maquina)::int AS machines, ROUND(AVG(temp_motor_c), 1)::float AS temperature, COUNT(*) FILTER (WHERE temp_motor_c > 100 OR NULLIF(vibracao_mm_s, 'NaN'::numeric) > 4.5)::int AS alerts FROM telemetry"),
  ])
  return {
    stats: stats.rows[0] as { readings: number; machines: number; temperature: number; alerts: number },
    series: daily.rows as { date: string; desktop: number; mobile: number }[],
    rows: records.rows.map((r) => ({
      id: Number(r.id_leitura), header: `Máquina #${String(r.id_maquina).padStart(2, "0")}`,
      type: r.rpm === null || Number(r.rpm) < 0 || Number.isNaN(Number(r.rpm)) ? "Ausente" : String(Math.round(Number(r.rpm))),
      status: Number(r.temp_motor_c) > 100 || Number(r.vibracao_mm_s) > 4.5 ? "Crítico" : Number(r.temp_motor_c) > 90 ? "Atenção" : "Normal",
      target: Number(r.temp_motor_c).toFixed(1), limit: r.vibracao_mm_s === null || !Number.isFinite(Number(r.vibracao_mm_s)) ? "Ausente" : Number(r.vibracao_mm_s).toFixed(2),
      reviewer: new Date(r.data_hora).toLocaleString("pt-BR", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" }),
    })),
  }
}
