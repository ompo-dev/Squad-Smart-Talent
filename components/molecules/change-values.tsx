export function ChangeValues({before,after,optimistic}:{before:number|null;after:number|null;optimistic?:boolean}) {
 return <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-muted p-3"><p className="text-muted-foreground">Valor na prévia</p><strong>{before??"Ausente"}</strong></div><div className="rounded-lg bg-muted p-3"><p className="text-muted-foreground">{optimistic?"Aplicado localmente · sincronizando":"Novo valor"}</p><strong>{after??"Ausente"}</strong></div></div>
}
