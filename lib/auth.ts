import {betterAuth} from "better-auth"
import {prismaAdapter} from "better-auth/adapters/prisma"
import {nextCookies} from "better-auth/next-js"
import {prisma} from "@/lib/prisma"
export function authReadiness(){
 const secret=!!process.env.BETTER_AUTH_SECRET&&process.env.BETTER_AUTH_SECRET.length>=32
 const google=!!process.env.GOOGLE_CLIENT_ID&&!!process.env.GOOGLE_CLIENT_SECRET
 return {enabled:secret&&google,googleConfigured:google,secretConfigured:secret}
}
function createAuth(){return betterAuth({secret:process.env.BETTER_AUTH_SECRET,baseURL:process.env.BETTER_AUTH_URL??"http://localhost:3000",database:prismaAdapter(prisma,{provider:"postgresql"}),socialProviders:{google:{clientId:process.env.GOOGLE_CLIENT_ID!,clientSecret:process.env.GOOGLE_CLIENT_SECRET!}},plugins:[nextCookies()]})}
let instance:ReturnType<typeof createAuth>|undefined
export function getAuth(){
 if(!authReadiness().enabled)return null
 return instance??=createAuth()
}
