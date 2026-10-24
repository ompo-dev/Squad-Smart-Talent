import {readFileSync,existsSync} from "node:fs"
import {createHmac} from "node:crypto"
if(existsSync(".env"))process.loadEnvFile(".env")
const filename=process.argv[2],secret=process.env.WEBHOOK_SECRET
if(!filename||!secret||secret.length<32)throw new Error("Uso: bunx tsx scripts/send-webhook.ts arquivo.json; configure WEBHOOK_SECRET no .env local")
const raw=readFileSync(filename),timestamp=String(Math.floor(Date.now()/1000)),signature="sha256="+createHmac("sha256",secret).update(timestamp+".").update(raw).digest("hex")
const response=await fetch(process.env.WEBHOOK_URL??"http://localhost:3000/api/webhooks/telemetry",{method:"POST",headers:{"Content-Type":"application/json","X-Webhook-Timestamp":timestamp,"X-Webhook-Signature":signature},body:raw,signal:AbortSignal.timeout(30000)})
console.log(JSON.stringify({status:response.status,result:await response.json()},null,2));if(!response.ok)process.exitCode=1
