import { PageShell } from "@/components/page-shell"
import { StandardTelemetryView } from "@/components/standard-telemetry-view"
import { getTelemetryView } from "@/lib/telemetry-view"

export const dynamic = "force-dynamic"
export default async function Page() {
  const data = await getTelemetryView()
  return <PageShell title="Visão geral da frota" description="Telemetria do arquivo importado · última leitura por máquina."><StandardTelemetryView {...data}/></PageShell>
}
