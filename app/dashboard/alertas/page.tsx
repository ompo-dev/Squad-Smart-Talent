import { PageShell } from "@/components/page-shell"
import { StandardTelemetryView } from "@/components/standard-telemetry-view"
import { getTelemetryView } from "@/lib/telemetry-view"
export const dynamic = "force-dynamic"
export default async function Page() {
  const { rows, series } = await getTelemetryView("alerts")
  return <PageShell title="Alertas" description="Leituras com parada registrada ou sensor em faixa crítica de triagem. Limites ilustrativos, não diagnósticos."><StandardTelemetryView mode="alerts" rows={rows} series={series}/></PageShell>
}
