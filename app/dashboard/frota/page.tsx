import { PageShell } from "@/components/page-shell"
import { StandardTelemetryView } from "@/components/standard-telemetry-view"
import { getTelemetryView } from "@/lib/telemetry-view"
export const dynamic = "force-dynamic"
export default async function Page() {
  const data = await getTelemetryView("readings")
  return <PageShell title="Frota" description="Todas as leituras da frota. Use a busca, os filtros, a ordenação, as colunas e a paginação da tabela."><StandardTelemetryView mode="readings" {...data}/></PageShell>
}
