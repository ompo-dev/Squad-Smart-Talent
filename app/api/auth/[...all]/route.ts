import {toNextJsHandler} from "better-auth/next-js"
import {getAuth} from "@/lib/auth"
import {tracedRoute} from "@/lib/observability/server"
async function handle(request:Request) {
 const auth=getAuth()
 if(!auth)return Response.json({error:"Login Google ainda não configurado.",configured:false},{status:503})
 const handlers=toNextJsHandler(auth)
 return request.method==="GET"?handlers.GET(request):handlers.POST(request)
}
export const GET=tracedRoute("GET /api/auth/:action",handle)
export const POST=tracedRoute("POST /api/auth/:action",handle)
