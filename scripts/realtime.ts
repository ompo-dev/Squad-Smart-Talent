import {createServer} from "node:http"
import {WebSocketServer,WebSocket} from "ws"
import {Redis} from "ioredis"
import {withTraceParent,withSpan,currentTrace} from "../lib/observability/server"
import {traceHeader} from "../lib/observability/context"
import {prisma} from "../lib/prisma"
const redis=new Redis(process.env.REDIS_URL??"redis://localhost:6379",{maxRetriesPerRequest:null})
redis.on("error",()=>console.warn(JSON.stringify({level:"warn",event:"realtime.redis_error"})))
const server=createServer((request,response)=>{if(request.url==="/health")response.writeHead(redis.status==="ready"?200:503,{"Content-Type":"application/json"}).end(JSON.stringify({status:redis.status==="ready"?"ok":"starting"}));else response.writeHead(404).end()})
const sockets=new WebSocketServer({noServer:true,maxPayload:16384})
server.on("upgrade",(request,socket,head)=>{
 try{const origin=request.headers.origin;if(origin){const source=new URL(origin),host=new URL(`http://${request.headers.host}`);const extra=(process.env.REALTIME_ALLOWED_ORIGINS??"").split(",");if(source.hostname!==host.hostname&&!extra.includes(origin))throw new Error("Origin denied")}
 sockets.handleUpgrade(request,socket,head,client=>sockets.emit("connection",client,request))}catch{socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");socket.destroy()}
})
const alive=new WeakMap<WebSocket,boolean>()
sockets.on("connection",socket=>{alive.set(socket,true);socket.on("pong",()=>alive.set(socket,true));socket.on("message",()=>socket.close(1008,"Read-only channel"));socket.send(JSON.stringify({type:"connected",at:new Date().toISOString()}))})
await redis.subscribe("telemetry:events")
redis.on("message",(_,message)=>{void (async()=>{let event:Record<string,unknown>;try{event=JSON.parse(message)}catch{return}if(!["telemetry.changed","job.submit","job.completed","job.failed"].includes(String(event.type)))return;await withTraceParent(typeof event.traceparent==="string"?event.traceparent:undefined,()=>withSpan("realtime.broadcast","websocket",async span=>{const trace=currentTrace(),message=JSON.stringify({...event,traceparent:trace?traceHeader(trace):undefined});let delivered=0;for(const socket of sockets.clients)if(socket.readyState===WebSocket.OPEN){if(socket.bufferedAmount>1048576)socket.close(1013,"Slow client");else try{socket.send(message);delivered++}catch{socket.terminate()}}span.attributes.count=delivered},{operation:String(event.type)}))})().catch(()=>console.warn(JSON.stringify({level:"warn",event:"realtime.broadcast_error"})))})
const timer=setInterval(()=>{for(const socket of sockets.clients){if(!alive.get(socket))socket.terminate();else{alive.set(socket,false);socket.ping()}}},30000)
server.listen(3002,"0.0.0.0",()=>console.log(JSON.stringify({level:"info",event:"realtime.ready"})))
async function stop(){clearInterval(timer);for(const socket of sockets.clients)socket.close(1001,"Server restarting");sockets.close();server.close();await redis.quit();await prisma.$disconnect();process.exit(0)}
process.on("SIGTERM",()=>void stop());process.on("SIGINT",()=>void stop())
