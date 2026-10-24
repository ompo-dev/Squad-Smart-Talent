import {unstable_cache,revalidateTag} from "next/cache"
import {prisma} from "@/lib/prisma"
import {withSpan} from "@/lib/observability/server"
import {redisConnection} from "./redis"
export async function redisReadThrough<T>(key:string,load:()=>Promise<T>):Promise<T> {
 let cached:string|null=null
 try {cached=await withSpan("cache.redis.get","redis",async span=>{const client=await redisConnection();span.attributes.cacheAvailable=!!client;if(!client){span.attributes.outcome="disabled";return null}const value=await client.get(key);span.attributes.outcome=value===null?"miss":"hit";return value})}catch{/* a cache failure must not prevent the database read */}
 if(cached!==null)try{return JSON.parse(cached) as T}catch{/* replace malformed cache entries */}
 const value=await load()
 try {await withSpan("cache.redis.set","redis",async span=>{const client=await redisConnection();span.attributes.outcome=client?"stored":"disabled";if(client)await client.set(key,JSON.stringify(value),{EX:60})})}catch{/* database result is authoritative */}
 return value
}
export async function cachedTelemetryView<T>(mode:string,load:()=>Promise<T>):Promise<T> {
 return withSpan("telemetry.read","api",async()=>{
   const revision=await withSpan("cache.revision","postgres",async()=>String((await prisma.cacheRevision.findUnique({where:{key:"telemetry"}}))?.value??0))
   const key=`telemetry:view:${revision}:${mode}`
   return withSpan("cache.next","next-cache",async span=>{
     let executed=false
     const get=unstable_cache(async()=>{executed=true;return redisReadThrough(key,load)},["telemetry-view",revision,mode],{revalidate:60,tags:["telemetry"]})
     const result=await get();span.attributes.outcome=executed?"miss":"hit";return result
   },{mode,revision})
 },{operation:"telemetry.read",mode})
}
export async function invalidateTelemetryCache(revision:string) {
 try {await withSpan("cache.redis.invalidate","redis",async span=>{const client=await redisConnection();span.attributes.outcome=client?"invalidated":"disabled";if(client)await client.set("telemetry:revision",revision)},{revision})}catch{/* revision was already committed in PostgreSQL */}
 if(process.env.NEXT_RUNTIME==="nodejs")try{await withSpan("cache.next.invalidate","next-cache",async()=>{revalidateTag("telemetry")},{revision})}catch{/* revision keys also invalidate previously cached views */}
}
