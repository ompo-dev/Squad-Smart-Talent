import {authReadiness} from "@/lib/auth"
export const dynamic="force-dynamic"
export async function GET(){return Response.json(authReadiness(),{headers:{"Cache-Control":"no-store"}})}
