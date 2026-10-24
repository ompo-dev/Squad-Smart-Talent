import {openapi} from "@/lib/openapi"
export async function GET(){return Response.json(openapi,{headers:{"Cache-Control":"public, max-age=60"}})}
