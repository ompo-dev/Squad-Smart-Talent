import {createClient} from "redis"
function makeRedis(){const connection=createClient({url:process.env.REDIS_URL,socket:{connectTimeout:1000,reconnectStrategy:false}});connection.on("error",()=>{});return connection}
let client:ReturnType<typeof makeRedis>|undefined
let connecting:Promise<void>|undefined
export async function redisConnection() {
 if(!process.env.REDIS_URL)return null
 client??=makeRedis()
 if(!client.isReady){if(!connecting)connecting=client.connect().then(()=>{}).finally(()=>{connecting=undefined});await connecting}
 return client
}
export async function closeRedis(){if(client?.isOpen)await client.quit();client=undefined;connecting=undefined}
