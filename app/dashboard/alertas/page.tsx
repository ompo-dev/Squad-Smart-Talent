import { PageShell } from "@/components/page-shell"
import { StandardTelemetryView } from "@/components/standard-telemetry-view"
import { getTelemetryView } from "@/lib/telemetry-view"
export const dynamic = "force-dynamic"
export default async function Page() {
  const data = await getTelemetryView("alerts")
  return <PageShell title="Alertas" description="Todas as leituras com parada registrada ou sensor em faixa crítica. Limites ilustrativos, não diagnósticos."><StandardTelemetryView mode="alerts" {...data}/></PageShell>
}
