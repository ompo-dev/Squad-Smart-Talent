"use client"
import {useState} from "react"
import Link from "next/link"
import {Button} from "@/components/atoms"
import {authClient} from "@/lib/client/auth-client"
export function LoginForm({configured}:{configured:boolean}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState("")
 const signIn=async()=>{setBusy(true);setError("");try{const result=await authClient.signIn.social({provider:"google",callbackURL:"/dashboard"});if(result.error)throw new Error("Não foi possível iniciar o login Google.")}catch(error){setError(error instanceof Error?error.message:"Falha ao entrar");setBusy(false)}}
 return <div className="space-y-4"><Button className="w-full" disabled={!configured||busy} onClick={()=>void signIn()}>{busy?"Redirecionando…":"Continuar com Google"}</Button>{!configured&&<p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Login Google em preparação. A configuração OAuth ainda está pendente.</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Link href="/dashboard" className="block text-center text-sm underline underline-offset-4">Abrir ambiente de demonstração</Link></div>
}
