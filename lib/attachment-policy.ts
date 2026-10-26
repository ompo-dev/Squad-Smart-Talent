export const MAX_ATTACHMENTS=3
export const MAX_ATTACHMENT_BYTES=5*1024*1024
export const ATTACHMENT_EXTENSIONS=["csv","xlsx","json","pdf","txt","md"] as const
export const TELEMETRY_EXTENSIONS=["csv","xlsx","json"] as const
export const ATTACHMENT_ACCEPT=ATTACHMENT_EXTENSIONS.map(extension=>`.${extension}`).join(",")
export function fileExtension(name:string){return name.split(".").pop()?.toLowerCase()??""}
export function canImportAttachment(name:string){return (TELEMETRY_EXTENSIONS as readonly string[]).includes(fileExtension(name))}
type LocalFile={name:string;size:number;lastModified:number}
export function fileIdentity(file:LocalFile){return JSON.stringify([file.name,file.size,file.lastModified])}
export function selectAttachmentFiles<T extends LocalFile>(selected:readonly T[],current:readonly LocalFile[]){
  const accepted:T[]=[],errors:string[]=[],seen=new Set(current.map(fileIdentity))
  for(const file of selected){
    if(seen.has(fileIdentity(file)))continue
    seen.add(fileIdentity(file))
    if(!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(fileExtension(file.name))){errors.push(`${file.name}: formato não aceito. Use CSV, XLSX, JSON, PDF, TXT ou MD.`);continue}
    if(!file.size||file.size>MAX_ATTACHMENT_BYTES){errors.push(`${file.name}: selecione um arquivo não vazio de até 5 MB.`);continue}
    if(current.length+accepted.length>=MAX_ATTACHMENTS){errors.push("Anexe até três arquivos por mensagem.");continue}
    accepted.push(file)
  }
  return {accepted,errors:[...new Set(errors)]}
}
