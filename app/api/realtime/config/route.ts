export async function GET(request:Request){
 const url=new URL(request.url),host=request.headers.get("host")??url.host,hostname=new URL(`http://${host}`).hostname
 return Response.json({url:process.env.REALTIME_PUBLIC_URL||`${url.protocol==="https:"?"wss":"ws"}://${hostname}:3002`,protocol:"telemetry.events.v1",events:["telemetry.changed","job.submit","job.completed","job.failed"],delivery:"at-least-once; refresh on reconnect"},{headers:{"Cache-Control":"no-store"}})
}
