"use client"
import {useMemo} from "react"
import {Bar,BarChart,CartesianGrid,Cell,LabelList,ReferenceLine,XAxis,YAxis} from "recharts"
import {Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle} from "@/components/ui/card"
import {ChartContainer,ChartTooltip,ChartTooltipContent,type ChartConfig} from "@/components/ui/chart"
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table"
import {buildMaintenanceReport,criticalTemperatureC,decimal,type MachineReport} from "@/lib/maintenance-report"
import {useTelemetryStore} from "@/lib/stores/telemetry-store"
import type {TelemetryRow} from "@/lib/types"

const highlight="hsl(var(--primary))",muted="hsl(var(--primary) / 0.45)"
const lineConfig={ratePct:{label:"Leituras com falha (%)",color:highlight}} satisfies ChartConfig
const machineConfig={points:{label:"Pontos (de 0 a 4)",color:highlight}} satisfies ChartConfig

function Criterion({met,value}:{met:boolean;value:string}) {
  return <TableCell className={`whitespace-normal ${met?"bg-muted font-medium":"text-muted-foreground"}`}><span aria-label={met?"Atende":"Não atende"}>{met?"✓":"–"}</span> {value}</TableCell>
}

const period=(machine:MachineReport)=>machine.alertsPer100Before===null||machine.alertsPer100After===null
  ? "sem comparação"
  : `${decimal(machine.alertsPer100Before)} → ${decimal(machine.alertsPer100After)}`

export function MaintenanceReport({rows:initialRows}:{rows:TelemetryRow[]}) {
  const rows=useTelemetryStore(state=>state.views.readings?.rows)??initialRows
  const report=useMemo(()=>buildMaintenanceReport(rows),[rows])
  if(!rows.length)return <Card><CardHeader><CardTitle>Análises de manutenção</CardTitle><CardDescription>Ainda não há leituras na base. Importe o dataset para calcular as taxas e a prioridade de inspeção.</CardDescription></CardHeader></Card>
  const topRate=report.lines[0]?.ratePct??null,topPoints=report.machines[0]?.points??0
  const lines=report.lines.map(line=>({...line,rate:line.ratePct??0,label:line.ratePct===null?`Sem rótulo de falha · ${line.readings} leituras`:`${decimal(line.ratePct)}% · ${line.failures} de ${line.analyzed}`}))
  return <div className="grid min-w-0 gap-6">
    <Card>
      <CardHeader><CardDescription>Qual linha apresenta maior proporção de leituras com falha?</CardDescription><CardTitle className="text-lg">{report.lineTitle}</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={lineConfig} className="aspect-auto w-full" style={{height:70+lines.length*48}}>
          <BarChart accessibilityLayer data={lines} layout="vertical" margin={{top:20,right:8,left:0,bottom:18}}>
            <CartesianGrid horizontal={false}/>
            <YAxis type="category" dataKey="line" width={96} tickLine={false} axisLine={false}/>
            <XAxis type="number" domain={[0,100]} ticks={[0,25,50,75,100]} tickFormatter={value=>`${value}%`} tickLine={false} axisLine={false} label={{value:"% das leituras analisadas",position:"insideBottom",offset:-12,fontSize:12}}/>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator formatter={(_,__,item)=>{const line=item.payload as typeof lines[number];return line.ratePct===null?line.label:`${line.label} · margem de 95%: ${decimal(line.marginMin??0)}% a ${decimal(line.marginMax??0)}%`}}/>}/>
            <Bar dataKey="rate" radius={4} barSize={26} isAnimationActive={false}>
              {lines.map(line=><Cell key={line.line} fill={line.ratePct!==null&&line.ratePct===topRate?highlight:muted}/>)}
              <LabelList dataKey="label" position="right" offset={16} className="fill-foreground" fontSize={12}/>
            </Bar>
            {report.fleetFailurePct!==null&&<ReferenceLine x={report.fleetFailurePct} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" label={{value:`Frota: ${decimal(report.fleetFailurePct)}%`,position:"top",fontSize:12}}/>}
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-sm text-muted-foreground">
        <p>{report.lineNote}</p>
        <p>Taxa = leituras com falha ÷ leituras com rótulo conhecido. Ao lado de cada barra: taxa · falhas de leituras analisadas. {report.fleetFailurePct===null?"Isto":`Com ${decimal(report.fleetFailurePct)}% das leituras com falha na frota, isto`} compara registros da base: não mede frequência real de quebra, duração de parada nem OEE.</p>
      </CardFooter>
    </Card>
    <Card>
      <CardHeader><CardDescription>Quais máquinas merecem investigação primeiro e por quê?</CardDescription><CardTitle className="text-lg">{report.priorityTitle}</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        <ChartContainer config={machineConfig} className="aspect-auto w-full" style={{height:70+report.machines.length*40}}>
          <BarChart accessibilityLayer data={report.machines} layout="vertical" margin={{top:0,right:24,left:0,bottom:18}}>
            <CartesianGrid horizontal={false}/>
            <YAxis type="category" dataKey="machine" width={150} tickLine={false} axisLine={false}/>
            <XAxis type="number" domain={[0,4]} ticks={[0,1,2,3,4]} allowDecimals={false} tickLine={false} axisLine={false} label={{value:"Pontos (de 0 a 4)",position:"insideBottom",offset:-12,fontSize:12}}/>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator/>}/>
            <Bar dataKey="points" radius={4} barSize={22} isAnimationActive={false}>
              {report.machines.map(machine=><Cell key={machine.machine} fill={topPoints>0&&machine.points===topPoints?highlight:muted}/>)}
              <LabelList dataKey="points" position="right" className="fill-foreground" fontSize={12}/>
            </Bar>
          </BarChart>
        </ChartContainer>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Máquina</TableHead><TableHead>Prioridade</TableHead>
            <TableHead className="min-w-28 whitespace-normal align-bottom">Alertas por 100 leituras acima da frota ({decimal(report.fleetAlertsPer100)})</TableHead>
            <TableHead className="min-w-28 whitespace-normal align-bottom">Leituras incompletas acima da frota ({decimal(report.fleetIncompletePct)}%)</TableHead>
            <TableHead className="min-w-28 whitespace-normal align-bottom">Refrigerante atingiu {criticalTemperatureC} °C</TableHead>
            <TableHead className="min-w-28 whitespace-normal align-bottom">Alertas subiram no 2º período</TableHead>
          </TableRow></TableHeader>
          <TableBody>{report.machines.map(machine=><TableRow key={machine.machine}>
            <TableCell className="whitespace-normal font-medium">{machine.machine}</TableCell>
            <TableCell className="whitespace-normal">{machine.points} de 4 · {machine.priority}{machine.tied?" · empate":""}</TableCell>
            <Criterion met={machine.criteria.alerts} value={decimal(machine.alertsPer100)}/>
            <Criterion met={machine.criteria.incomplete} value={`${decimal(machine.incompletePct)}%`}/>
            <Criterion met={machine.criteria.temperature} value={machine.maxTemperature===null?"sem leitura":`máx. ${decimal(machine.maxTemperature,1)} °C · ${machine.criticalTemperatureReadings===1?"1 leitura":`${machine.criticalTemperatureReadings} leituras`}`}/>
            <Criterion met={machine.criteria.trend} value={period(machine)}/>
          </TableRow>)}</TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-sm text-muted-foreground">
        {report.temperatureNote&&<p className="font-medium text-foreground">{report.temperatureNote}</p>}
        <p>Alerta = falha registrada ou temperatura, vibração ou pressão em faixa crítica; uma leitura soma até 4 alertas.</p>
        <p>Cada critério atendido vale 1 ponto (Alta: 3 ou 4 · Média: 2 · Baixa: 0 ou 1). No empate, a ordem é alfabética. Períodos separados em 26/03/2022.</p>
        <p>É triagem para decidir onde olhar primeiro: não é diagnóstico nem previsão de falha. Estes dados não têm a duração das paradas e não permitem calcular OEE.</p>
      </CardFooter>
    </Card>
  </div>
}
