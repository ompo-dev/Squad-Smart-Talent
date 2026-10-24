"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { ActivityIcon, BellIcon, BotIcon, ChartNoAxesCombinedIcon, DatabaseIcon, GaugeIcon, Settings2Icon } from "lucide-react"

const data = {
  user: {
    name: "Ana Gomes",
    email: "operations@telemetry.os",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Telemetry OS",
      logo: <ActivityIcon />,
      plan: "Operations",
    },
    {
      name: "Linha Norte",
      logo: <DatabaseIcon />,
      plan: "Industrial",
    },
    {
      name: "Planta Sul",
      logo: <GaugeIcon />,
      plan: "Industrial",
    },
  ],
  navMain: [
    {
      title: "Visão geral",
      url: "/dashboard",
      icon: <ChartNoAxesCombinedIcon />,
      isActive: true,
    },
    {
      title: "Frota",
      url: "/dashboard/frota",
      icon: <GaugeIcon />,
    },
    {
      title: "Alertas",
      url: "/dashboard/alertas",
      icon: <BellIcon />,
    },
    {
      title: "Copiloto IA",
      url: "/dashboard/copiloto",
      icon: <BotIcon />,
    },
  ],
  projects: [
    {
      name: "Relatórios",
      url: "/dashboard/relatorios",
      icon: <ChartNoAxesCombinedIcon />,
    },
    {
      name: "Fontes de dados",
      url: "/dashboard/dados",
      icon: <DatabaseIcon />,
    },
    {
      name: "Configurações",
      url: "/dashboard/configuracoes",
      icon: <Settings2Icon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
