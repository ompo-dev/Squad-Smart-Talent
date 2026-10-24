import {Queue} from "bullmq"
import type {RedisOptions} from "bullmq"
export function queueConnection(worker=false):RedisOptions {
 const url=new URL(process.env.REDIS_URL??"redis://localhost:6379")
 return {host:url.hostname,port:Number(url.port||6379),username:url.username?decodeURIComponent(url.username):undefined,password:url.password?decodeURIComponent(url.password):undefined,db:Number(url.pathname.slice(1)||0),maxRetriesPerRequest:worker?null:1,...(url.protocol==="rediss:"?{tls:{}}:{})}
}
let queue:Queue<{jobId:string}>|undefined
export function importQueue(){if(!queue){queue=new Queue("telemetry-imports",{connection:queueConnection(),defaultJobOptions:{attempts:5,backoff:{type:"exponential",delay:1000},removeOnComplete:{age:86400,count:1000},removeOnFail:{age:604800,count:1000}}});queue.on("error",()=>console.warn(JSON.stringify({level:"warn",event:"queue.connection_error"})))}return queue}
export async function closeImportQueue(){if(queue)await queue.close();queue=undefined}
