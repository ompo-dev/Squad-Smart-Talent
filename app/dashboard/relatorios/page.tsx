import { MaintenanceReport } from "@/components/maintenance-report"
import { PageShell } from "@/components/page-shell"
import { StandardTelemetryView } from "@/components/standard-telemetry-view"
import { getTelemetryView } from "@/lib/telemetry-view"
export const dynamic = "force-dynamic"
export default async function Page() {
  const data = await getTelemetryView("readings")
  return <PageShell title="Relatórios" description="Taxa de falhas por linha, prioridade de inspeção, série diária e todas as leituras disponíveis no PostgreSQL."><div className="flex min-w-0 flex-col gap-6"><MaintenanceReport rows={data.rows}/><StandardTelemetryView mode="readings" {...data}/></div></PageShell>
}
