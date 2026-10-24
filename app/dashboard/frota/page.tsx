import { PageShell } from "@/components/page-shell"
import { StandardTelemetryView } from "@/components/standard-telemetry-view"
import { getTelemetryView } from "@/lib/telemetry-view"
export const dynamic = "force-dynamic"
export default async function Page() {
  const { rows, series } = await getTelemetryView()
  return <PageShell title="Frota" description="Última leitura por máquina. Use a busca, os filtros, as colunas e a paginação da tabela."><StandardTelemetryView rows={rows} series={series}/></PageShell>
}
