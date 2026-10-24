import {FileText,X} from "lucide-react"
export function AttachmentChip({file,disabled,onRemove}:{file:{name:string};disabled?:boolean;onRemove:()=>void}) {
 return <span className="inline-flex max-w-full items-center gap-2 rounded-lg border bg-muted/50 px-2 py-1 text-xs"><FileText className="size-3.5 shrink-0"/><span className="truncate">{file.name}</span><button aria-label={`Remover ${file.name}`} disabled={disabled} onClick={onRemove}><X className="size-3.5"/></button></span>
}
