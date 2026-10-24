import { NextResponse } from "next/server"
import { z } from "zod"
import { executeAgentTool } from "@/lib/agent-tools"
const schema = z.object({ name: z.enum(["get_fleet_summary", "query_telemetry", "aggregate_telemetry", "inspect_telemetry_schema"]), args: z.record(z.string(), z.unknown()).default({}) }).strict()
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({error:"Função ou argumentos inválidos."}, {status:400})
  try { const data = await executeAgentTool(parsed.data.name, parsed.data.args); return NextResponse.json({id:crypto.randomUUID(),name:parsed.data.name,args:parsed.data.args,data}, {headers:{"Cache-Control":"no-store"}}) }
  catch (error) { return NextResponse.json({error:error instanceof z.ZodError ? "Filtros inválidos. Confira os campos preenchidos." : "Não foi possível consultar a telemetria."}, {status:400}) }
}
