import { listThreads } from "@/lib/chat-db"
export const dynamic = "force-dynamic"
export async function GET() { return Response.json({threads:await listThreads()}, {headers:{"Cache-Control":"no-store"}}) }
