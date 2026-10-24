import {POST as handlePOST} from "@/lib/chat-agent"
import {tracedRoute} from "@/lib/observability/server"
export const POST=tracedRoute("POST /api/ai",handlePOST)
export const runtime="nodejs"
export const maxDuration=180
