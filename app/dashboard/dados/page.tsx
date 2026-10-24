import {PageShell} from "@/components/page-shell"
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card"
import {DataImportForm} from "@/components/organisms/data-import-form"
import {prisma} from "@/lib/prisma"
export const dynamic="force-dynamic"
export default async function Page() {
 const count=await prisma.telemetry.count()
 return <PageShell title="Fontes de dados" description="Importe coletas e acompanhe a origem das leituras."><div className="grid gap-5 lg:grid-cols-3"><Card><CardHeader><CardDescription>PostgreSQL · Prisma ORM</CardDescription><CardTitle className="text-3xl">{count.toLocaleString("pt-BR")}</CardTitle><CardDescription>Leituras na base</CardDescription></CardHeader></Card><Card className="lg:col-span-2"><CardHeader><CardTitle>Importar CSV de telemetria</CardTitle><CardDescription>Normalização e validação em TypeScript, sem serviço Python.</CardDescription></CardHeader><CardContent><DataImportForm/></CardContent></Card></div></PageShell>
}
