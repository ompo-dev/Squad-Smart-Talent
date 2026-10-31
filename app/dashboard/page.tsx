import { PageShell } from "@/components/page-shell"
import { StandardTelemetryView } from "@/components/standard-telemetry-view"
import { getTelemetryView } from "@/lib/telemetry-view"

export const dynamic = "force-dynamic"
export default async function Page() {
  const data = await getTelemetryView("readings")
  return <PageShell title="Visão geral da frota" description="Todas as leituras disponíveis no PostgreSQL, com filtros, ordenação e paginação."><StandardTelemetryView mode="readings" {...data}/></PageShell>
}
