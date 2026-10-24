import { PageShell } from "@/components/page-shell"
import { StandardTelemetryView } from "@/components/standard-telemetry-view"
import { getTelemetryView } from "@/lib/telemetry-view"
export const dynamic = "force-dynamic"
export default async function Page() {
  const { rows, series } = await getTelemetryView("alerts")
  return <PageShell title="Alertas" description="Leituras históricas com temperatura acima de 100 °C ou vibração acima de 4,5 mm/s. Limites de triagem."><StandardTelemetryView mode="alerts" rows={rows} series={series}/></PageShell>
}
