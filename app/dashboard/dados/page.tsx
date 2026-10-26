import {PageShell} from "@/components/page-shell"
import {DataSourcesWorkspace} from "@/components/organisms/data-sources-workspace"
import {prisma} from "@/lib/prisma"
export const dynamic="force-dynamic"
export default async function Page() {
 const [telemetry,lastImportJob,lastCsv,lastWebhook]=await Promise.all([
   prisma.telemetry.aggregate({_count:{_all:true},_max:{timestamp:true}}),
   prisma.importJob.findFirst({where:{status:"completed"},orderBy:{updatedAt:"desc"},select:{id:true,filename:true}}),
   prisma.commandReceipt.findFirst({where:{type:"telemetry.import-csv"},orderBy:{createdAt:"desc"},select:{id:true,createdAt:true}}),
   prisma.commandReceipt.findFirst({where:{type:"telemetry.webhook"},orderBy:{createdAt:"desc"},select:{createdAt:true}}),
 ])
 return <PageShell title="Fontes de dados" description="Traga leituras por arquivos, APIs e webhooks. Acompanhe os recebimentos e a atualização automática dos painéis.">
   <DataSourcesWorkspace
     readings={telemetry._count._all}
     lastReadingAt={telemetry._max.timestamp?.toISOString()??null}
     lastImport={lastCsv?{filename:lastImportJob&&lastCsv.id===`telemetry.import-csv:job-${lastImportJob.id}`?lastImportJob.filename:null,at:lastCsv.createdAt.toISOString()}:null}
     lastWebhookAt={lastWebhook?.createdAt.toISOString()??null}
     webhookEnabled={(process.env.WEBHOOK_SECRET?.length??0)>=32}
   />
 </PageShell>
}
