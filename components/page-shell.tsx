"use client"
import * as React from "react"
import { RefreshCw } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import {useRealtimeStore} from "@/lib/stores/realtime-store"

export function PageShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const connected=useRealtimeStore(state=>state.connected)
  return <SidebarProvider><AppSidebar /><SidebarInset><header className="flex min-h-16 items-center gap-3 border-b bg-background px-4 py-3 lg:px-6"><SidebarTrigger className="-ml-1"/><Separator orientation="vertical" className="h-5"/><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">TelemetryOS</p><h1 className="text-sm font-semibold">{title}</h1></div><div className="ml-auto flex items-center gap-2"><Badge variant="outline" className={`hidden gap-1.5 sm:flex ${connected?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-amber-200 bg-amber-50 text-amber-700"}`} title="Conexão para atualizar os painéis quando novas leituras chegarem"><span className={`h-1.5 w-1.5 rounded-full ${connected?"bg-emerald-500":"bg-amber-500"}`}/>{connected?"Atualização automática":"Reconectando"}</Badge><Button variant="ghost" size="icon" aria-label="Atualizar dados" onClick={()=>window.location.reload()}><RefreshCw size={16}/></Button></div></header><main className="flex flex-1 flex-col gap-5 bg-muted/20 p-4 lg:p-6"><div><h2 className="text-2xl font-bold tracking-tight">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{children}</main></SidebarInset></SidebarProvider>
}
