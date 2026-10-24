import { pool } from "@/lib/agent-tools"
import { ensureChatSchema } from "@/lib/chat-db"
export const runtime="nodejs"
export async function POST(request:Request) {
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
    await ensureChatSchema()
    const id=crypto.randomUUID(),name=file.name.replace(/[\r\n]/g," ").slice(0,180)
    await pool.query("INSERT INTO chat_files(id,name,media_type,size,content) VALUES($1,$2,$3,$4,$5)",[id,name,file.type,file.size,content])
    return Response.json({id,name,size:file.size,characters:content.length})
  } catch(error) {return Response.json({error:error instanceof Error?error.message:"Não foi possível ler o arquivo"},{status:400})}
}
