import {parse} from "csv-parse/sync"
import {canImportAttachment,fileExtension} from "@/lib/attachment-policy"
import {canonicalHeader,fieldForColumn,fieldForHeader,requiredFields,telemetryColumns,type TelemetryField} from "@/lib/telemetry-schema"

const outputFields=telemetryColumns.map(column=>fieldForColumn(column)) as TelemetryField[]
const columnByAlias=fieldForHeader

function cellValue(value:unknown):unknown{
  if(value instanceof Date)return value.toISOString()
  if(value&&typeof value==="object"&&!Array.isArray(value)){
    const cell=value as Record<string,unknown>
    if("formula" in cell||"sharedFormula" in cell)return cellValue(cell.result)
    if(Array.isArray(cell.richText))return cell.richText.map(part=>String(part?.text??"")).join("")
    if(typeof cell.text==="string")return cell.text
  }
  return value
}
function columnIndexes(headers:unknown[]){
  const indexes=new Map<TelemetryField,number>()
  headers.forEach((header,index)=>{
    const field=columnByAlias(cellValue(header))
    if(!field)return
    if(indexes.has(field))throw new Error(`Duas colunas representam ${canonicalHeader[field]}. Mantenha apenas uma antes de importar.`)
    indexes.set(field,index)
  })
  const missing=requiredFields.filter(field=>!indexes.has(field))
  if(missing.length)throw new Error(`Colunas de telemetria ausentes: ${missing.map(field=>canonicalHeader[field]).join(", ")}. O arquivo continua disponível para análise.`)
  return indexes
}
function rowsFromTable(rows:unknown[][]){
  if(rows.length<2)throw new Error("O arquivo precisa conter um cabeçalho e ao menos uma leitura.")
  const indexes=columnIndexes(rows[0])
  return rows.slice(1).filter(row=>row.some(value=>value!==null&&value!==undefined&&String(value).trim()!==""))
    .map(row=>outputFields.map(field=>{const index=indexes.get(field);return index===undefined?"":cellValue(row[index])}))
}
function csvRows(content:string){
  let delimiter=","
  let bestScore=-1
  for(const candidate of [",",";","\t"]){
    try{
      const first=parse(content,{delimiter:candidate,bom:true,skip_empty_lines:true,to:1})[0] as unknown[]|undefined
      const score=first?.filter(value=>fieldForHeader(value)&&requiredFields.includes(fieldForHeader(value)!)).length??0
      if(score>bestScore){bestScore=score;delimiter=candidate}
    }catch{/* Try the other supported separators. */}
  }
  try{return rowsFromTable(parse(content,{delimiter,bom:true,skip_empty_lines:true,trim:true}) as unknown[][])}
  catch(error){if(typeof (error as {code?:unknown})?.code==="string"&&(error as {code:string}).code.startsWith("CSV_"))throw new Error("CSV malformado: confira as aspas e a quantidade de colunas de cada linha.");throw error}
}
function jsonRows(content:string){
  let value:unknown
  try{value=JSON.parse(content.replace(/^\uFEFF/,""))}catch{throw new Error("JSON inválido. Corrija a estrutura do arquivo antes de importar.")}
  if(value&&typeof value==="object"&&!Array.isArray(value)){
    const object=value as Record<string,unknown>
    value=object.readings??object.leituras??object.data??object.dados
  }
  if(!Array.isArray(value)||!value.length)throw new Error("Use uma lista JSON de leituras ou um objeto com readings, leituras, data ou dados que contenha as colunas de telemetria.")
  if(value.every(Array.isArray))return rowsFromTable(value as unknown[][])
  if(!value.every(row=>row&&typeof row==="object"&&!Array.isArray(row)))throw new Error("Cada leitura JSON precisa ser um objeto com os campos de telemetria.")
  const headers=[...new Set(value.flatMap(row=>Object.keys(row as object)))]
  return rowsFromTable([headers,...value.map(row=>headers.map(header=>(row as Record<string,unknown>)[header]))])
}
function xlsxRows(content:string){
  const sheets:unknown[][][]=[],lines=content.split(/\r?\n/)
  let sheet:unknown[][]=[]
  for(const line of lines){
    if(line.startsWith("Planilha: ")){if(sheet.length)sheets.push(sheet);sheet=[];continue}
    if(!line.trim())continue
    let row:unknown
    try{row=JSON.parse(line)}catch{throw new Error("Não foi possível ler a planilha anexada. Anexe o XLSX novamente.")}
    if(!Array.isArray(row))throw new Error("Estrutura de planilha inválida.")
    sheet.push(row.slice(1))
  }
  if(sheet.length)sheets.push(sheet)
  const readings:unknown[][]=[]
  for(const table of sheets){
    const header=table.slice(0,20).findIndex(row=>requiredFields.every(field=>row.some(value=>fieldForHeader(cellValue(value))===field)))
    if(header>=0)readings.push(...rowsFromTable(table.slice(header)))
  }
  if(!readings.length)throw new Error("Nenhuma aba contém as colunas de telemetria necessárias (data, máquina e linha de montagem). As outras abas continuam disponíveis para análise.")
  return readings
}
function csvCell(value:unknown){
  const text=String(value??"")
  return /[,"\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text
}
export function normalizeTelemetryAttachment(name:string,content:string){
  if(!canImportAttachment(name))throw new Error("Para adicionar leituras à base, use CSV, XLSX ou JSON. Os demais formatos podem ser analisados no chat.")
  if(!content.trim()||content.length>1500000)throw new Error("O conteúdo do arquivo está vazio ou excede o limite de leitura.")
  const extension=fileExtension(name)
  const rows=extension==="csv"?csvRows(content):extension==="json"?jsonRows(content):xlsxRows(content)
  const csv=[telemetryColumns.join(","),...rows.map(row=>row.map(csvCell).join(","))].join("\n")
  if(csv.length>5*1024*1024)throw new Error("O arquivo normalizado excede 5 MB.")
  return csv
}
