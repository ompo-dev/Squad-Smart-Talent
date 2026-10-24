"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => item.items?.length ? (
          <Collapsible key={item.title} defaultOpen={item.isActive} className="group/collapsible" render={<SidebarMenuItem />}>
            <CollapsibleTrigger render={<SidebarMenuButton tooltip={item.title} />}>
              {item.icon}<span>{item.title}</span><span className="ml-auto text-xs transition-transform duration-200 group-data-open/collapsible:rotate-90">›</span>
            </CollapsibleTrigger>
            <CollapsibleContent><SidebarMenuSub>{item.items.map((subItem) => <SidebarMenuSubItem key={subItem.title}><SidebarMenuSubButton render={<a href={subItem.url} />}><span>{subItem.title}</span></SidebarMenuSubButton></SidebarMenuSubItem>)}</SidebarMenuSub></CollapsibleContent>
          </Collapsible>
        ) : (
          <SidebarMenuItem key={item.title}><SidebarMenuButton render={<a href={item.url} />} tooltip={item.title}>{item.icon}<span>{item.title}</span></SidebarMenuButton></SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
