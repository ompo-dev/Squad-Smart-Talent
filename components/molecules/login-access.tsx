"use client"
import {useEffect,useState} from "react"
import Link from "next/link"
import type {Route} from "next"
import {LogIn,LogOut} from "lucide-react"
import {Button} from "@/components/atoms"
import {authClient} from "@/lib/client/auth-client"
export function LoginAccess(){
 const [user,setUser]=useState<{name:string}|null>(null)
 useEffect(()=>{let active=true;fetch("/api/auth/status").then(res=>res.json()).then(async status=>{if(status.enabled){const session=await authClient.getSession();if(active&&session.data)setUser(session.data.user)}}).catch(()=>{});return()=>{active=false}},[])
 if(user)return <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm group-data-[collapsible=icon]:hidden">{user.name}</span><Button variant="ghost" size="icon" aria-label="Sair" onClick={()=>void authClient.signOut().then(()=>setUser(null))}><LogOut className="size-4"/></Button></div>
 return <Button variant="outline" className="w-full justify-start" render={<Link href={"/login" as Route}/>}><LogIn className="size-4"/><span className="group-data-[collapsible=icon]:hidden">Entrar</span></Button>
}
