import {tracedRoute} from "@/lib/observability/server"
import {executeCommand,payloadHash,CommandConflict} from "@/lib/application/command-bus"
export const runtime="nodejs"
async function handlePOST(request:Request) {
  const form=await request.formData().catch(()=>null),file=form?.get("file")
  if(!(file instanceof File)||file.size>5*1024*1024||!file.size) return Response.json({error:"Selecione um arquivo de até 5 MB"},{status:400})
  const extension=file.name.split(".").pop()?.toLowerCase()
  if(!["csv","txt","md","json","pdf","xlsx"].includes(extension??"")) return Response.json({error:"Formatos aceitos: CSV, TXT, MD, JSON, PDF com texto e XLSX"},{status:400})
  try {
    let content=""
    if(extension==="pdf") {
      const {PDFParse}=await import("pdf-parse")
      const parser=new PDFParse({data:new Uint8Array(await file.arrayBuffer())})
      try {content=(await parser.getText()).text} finally {await parser.destroy()}
    } else if(extension==="xlsx") {
      const {default:ExcelJS}=await import("exceljs")
      const book=new ExcelJS.Workbook()
      await book.xlsx.load(await file.arrayBuffer())
      let cells=0
      book.eachSheet((sheet)=>{content+=`\nPlanilha: ${sheet.name}\n`;sheet.eachRow((row)=>{cells+=row.cellCount;if(cells>100000) throw new Error("Planilha muito grande");content+=JSON.stringify(row.values)+"\n"})})
    } else content=await file.text()
    if(!content.trim()) throw new Error("Arquivo sem texto legível. PDFs digitalizados precisam de OCR antes do envio.")
    if(content.length>1500000) throw new Error("O conteúdo extraído excede 1,5 milhão de caracteres")
    if(content.includes("\u0000")) throw new Error("O arquivo contém dados binários ou texto inválido")
    const name=file.name.replace(/[\r\n\[\]]/g," ").slice(0,180),payload={name,mediaType:file.type,size:file.size,content}
    const result=await executeCommand({type:"attachment.upload",payload,idempotencyKey:request.headers.get("Idempotency-Key")??payloadHash(payload)},async(tx,data)=>{
      const saved=await tx.chatFile.create({data:{id:crypto.randomUUID(),...data}})
      return {id:saved.id,name:saved.name,size:saved.size,characters:saved.content.length}
    })
    return Response.json(result)
  } catch(error) {return Response.json({error:error instanceof Error?error.message:"Não foi possível ler o arquivo"},{status:error instanceof CommandConflict?409:400})}
}

export const POST=tracedRoute("POST /api/uploads",handlePOST)
