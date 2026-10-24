import {tracedRoute} from "@/lib/observability/server"
import { listThreads } from "@/lib/chat-db"
export const dynamic = "force-dynamic"
async function handleGET() { return Response.json({threads:await listThreads()}, {headers:{"Cache-Control":"no-store"}}) }

export const GET=tracedRoute("GET /api/threads/get",handleGET)
