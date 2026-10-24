import { PageShell } from "@/components/page-shell"
import { StandardTelemetryView } from "@/components/standard-telemetry-view"
import { getTelemetryView } from "@/lib/telemetry-view"
export const dynamic = "force-dynamic"
export default async function Page() {
  const data = await getTelemetryView("readings")
  return <PageShell title="Relatórios" description="Série diária e 200 leituras mais recentes do PostgreSQL."><StandardTelemetryView {...data}/></PageShell>
}
