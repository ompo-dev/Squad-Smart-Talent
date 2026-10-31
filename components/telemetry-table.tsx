"use client"

import * as React from "react"
import {ArrowDown,ArrowUp,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight} from "lucide-react"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select"
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table"
import {sensorDefinitions,type SensorKey} from "@/lib/telemetry-schema"
import type {TelemetryRow} from "@/lib/types"

type ColumnKey = keyof TelemetryRow | "quality"
type Column = {key:ColumnKey;label:string;unit?:string;align?:"right";kind?:"date"|"status"|"downtime"|"quality"|"recordKey"}

const decimal = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3})
const dateFormat = new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeZone:"UTC"})
const statusOrder:Record<string,number> = {Falha:0,Crítico:1,Atenção:2,Normal:3}

const columns:Column[] = [
  {key:"timestamp",label:"Data",kind:"date"},
  {key:"machineId",label:"Máquina"},
  {key:"assemblyLine",label:"Linha de montagem"},
  {key:"status",label:"Condição",kind:"status"},
  {key:"downtime",label:"Parada",kind:"downtime"},
  {key:"downtimeLabel",label:"Rótulo de parada"},
  ...sensorDefinitions.map(definition=>({key:definition.key as SensorKey as ColumnKey,label:definition.label,unit:definition.unit,align:"right" as const})),
  {key:"qualityIssues",label:"Qualidade",kind:"quality"},
  {key:"version",label:"Versão",align:"right"},
  {key:"recordKey",label:"Record key",kind:"recordKey"},
]

function format(value:number|null|undefined,unit?:string){
  if(value===null||value===undefined||!Number.isFinite(value))return "—"
  return unit?`${decimal.format(value)} ${unit}`:decimal.format(value)
}

function statusBadge(status:string){
  const className=status==="Falha"?"border-rose-300 bg-rose-100 text-rose-800"
    :status==="Crítico"?"border-rose-200 bg-rose-50 text-rose-700"
    :status==="Atenção"?"border-amber-200 bg-amber-50 text-amber-700"
    :"border-emerald-200 bg-emerald-50 text-emerald-700"
  return <Badge variant="outline" className={className}>{status}</Badge>
}

function sortValue(row:TelemetryRow,key:ColumnKey):string|number|null{
  if(key==="quality")return row.qualityIssues.length
  if(key==="timestamp")return Date.parse(row.timestamp)
  if(key==="status")return statusOrder[row.status]??9
  if(key==="downtime")return row.downtime===null?null:Number(row.downtime)
  const value=row[key]
  return typeof value==="string"||typeof value==="number"?value:null
}

function cell(row:TelemetryRow,column:Column){
  if(column.kind==="date")return <span className="whitespace-nowrap">{dateFormat.format(new Date(row.timestamp))}</span>
  if(column.kind==="status")return statusBadge(row.status)
  if(column.kind==="downtime")return row.downtime===null?<span className="text-muted-foreground">—</span>:<Badge variant="outline" className={row.downtime?"border-rose-200 bg-rose-50 text-rose-700":"border-slate-200 bg-slate-50 text-slate-600"}>{row.downtime?"Sim":"Não"}</Badge>
  if(column.kind==="quality")return row.qualityIssues.length
    ? <span className="line-clamp-2 max-w-[260px] text-xs text-amber-700" title={row.qualityIssues.join(" · ")}>{row.qualityIssues.length} aviso(s)</span>
    : <span className="text-xs text-emerald-700">OK</span>
  if(column.kind==="recordKey")return <span className="font-mono text-[10px] text-muted-foreground" title={row.recordKey}>{row.recordKey.slice(0,12)}…</span>
  if(column.key==="version")return <span className="tabular-nums">{row.version}</span>
  if(column.align==="right")return <span className="whitespace-nowrap tabular-nums">{format(row[column.key as keyof TelemetryRow] as number|null,column.unit)}</span>
  return <span>{String(row[column.key as keyof TelemetryRow]??"—")}</span>
}

export function TelemetryTable({rows,compact=false}:{rows:TelemetryRow[];compact?:boolean}){
  const [page,setPage]=React.useState(0)
  const [pageSize,setPageSize]=React.useState(compact?10:25)
  const [sort,setSort]=React.useState<{key:ColumnKey;descending:boolean}>({key:"timestamp",descending:true})
  React.useEffect(()=>setPage(0),[rows,pageSize])
  const sorted=React.useMemo(()=>{
    const direction=sort.descending?-1:1
    return [...rows].sort((left,right)=>{
      const a=sortValue(left,sort.key),b=sortValue(right,sort.key)
      if(a===b)return 0
      if(a===null)return 1
      if(b===null)return -1
      return (a<b?-1:a>b?1:0)*direction
    })
  },[rows,sort])
  const pageCount=Math.max(1,Math.ceil(sorted.length/pageSize))
  const current=Math.min(page,pageCount-1)
  const visible=sorted.slice(current*pageSize,(current+1)*pageSize)
  function toggle(key:ColumnKey){
    setSort(previous=>previous.key===key?{key,descending:!previous.descending}:{key,descending:key!=="machineId"&&key!=="assemblyLine"&&key!=="status"&&key!=="recordKey"})
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{rows.length.toLocaleString("pt-BR")} registro(s) exibido(s) · todas as colunas da base</span>
      <div className="flex items-center gap-2"><span>Linhas por página</span><Select value={String(pageSize)} onValueChange={value=>value&&setPageSize(Number(value))}><SelectTrigger size="sm" className="w-20"><SelectValue/></SelectTrigger><SelectContent side="top">{[10,25,50,100,250].map(size=><SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[2400px]">
        <TableHeader className="bg-muted/70">
          <TableRow>{columns.map(column=><TableHead key={String(column.key)} className={column.align==="right"?"text-right":"whitespace-nowrap"}><button type="button" className="inline-flex items-center gap-1 font-medium hover:text-foreground" onClick={()=>toggle(column.key)}>{column.label}{sort.key===column.key?(sort.descending?<ArrowDown className="size-3"/>:<ArrowUp className="size-3"/>):null}</button></TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {visible.length?visible.map(row=><TableRow key={row.id}>{columns.map(column=><TableCell key={String(column.key)} className={column.align==="right"?"text-right":"align-top"}>{cell(row,column)}</TableCell>)}</TableRow>):<TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">Nenhuma leitura corresponde aos filtros.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>Página {current+1} de {pageCount}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-8" disabled={current===0} onClick={()=>setPage(0)} aria-label="Primeira página"><ChevronsLeft className="size-4"/></Button>
        <Button variant="outline" size="icon" className="size-8" disabled={current===0} onClick={()=>setPage(current-1)} aria-label="Página anterior"><ChevronLeft className="size-4"/></Button>
        <Button variant="outline" size="icon" className="size-8" disabled={current>=pageCount-1} onClick={()=>setPage(current+1)} aria-label="Próxima página"><ChevronRight className="size-4"/></Button>
        <Button variant="outline" size="icon" className="size-8" disabled={current>=pageCount-1} onClick={()=>setPage(pageCount-1)} aria-label="Última página"><ChevronsRight className="size-4"/></Button>
      </div>
    </div>
  </div>
}
