import {CommandConflict} from "@/lib/application/command-bus"
export function requestCommandKey(request:Request) {
 const key=request.headers.get("Idempotency-Key")??crypto.randomUUID()
 if(key.length<8||key.length>128)throw new Error("Chave de idempotência inválida")
 return key
}
export async function commandResponse(run:()=>Promise<unknown>) {
 try{return Response.json(await run())}catch(error){const code=(error as {code?:string}).code;const message=code==="P2025"?"Registro não encontrado":code==="P2002"?"Registro já criado por outra requisição":code?.startsWith("P")?"Não foi possível concluir o comando":error instanceof Error?error.message:"Falha no comando";return Response.json({error:message},{status:error instanceof CommandConflict||code==="P2002"?409:code==="P2025"?404:code?.startsWith("P")?500:400})}
}
