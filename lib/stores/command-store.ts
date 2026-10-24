"use client"
import {create} from "zustand"
import axios from "axios"
import {startClientFlow} from "@/lib/observability/client"
type Entry={requestId?:string;status:string;pending:boolean;error?:string;optimisticValue?:number|null;traceparent?:string}
type Store={entries:Record<string,Entry>;hydrate:(id:string,status:string)=>void;confirmChange:(id:string,value:number|null)=>Promise<void>}
const inflight=new Map<string,Promise<void>>()
export const useCommandStore=create<Store>((set,get)=>({
 entries:{},
 hydrate:(id,status)=>{if(!get().entries[id]?.requestId)set(state=>({entries:{...state.entries,[id]:{status,pending:false}}}))},
 confirmChange:(id,value)=>{
   const current=inflight.get(id);if(current)return current
   const previous=get().entries[id]??{status:"pending",pending:false},requestId=previous.requestId??crypto.randomUUID()
   const flow=startClientFlow("telemetry.apply-change"),traceparent=flow.mark("zustand.optimistic")
   set(state=>({entries:{...state.entries,[id]:{requestId,status:"applied",pending:true,optimisticValue:value,traceparent}}}))
   const request=axios.post(`/api/changes/${id}`,{},{headers:{"Idempotency-Key":requestId,traceparent:flow.header()}}).then(({data,headers})=>{
     flow.serverParent(headers?.traceparent);const traceparent=flow.mark("zustand.commit")
     set(state=>({entries:{...state.entries,[id]:{requestId,status:data.status,pending:false,optimisticValue:value,traceparent}}}));flow.flush()
   }).catch(error=>{
     if(axios.isAxiosError(error))flow.serverParent(error.response?.headers?.traceparent)
     const traceparent=flow.mark("zustand.rollback","error")
     set(state=>({entries:{...state.entries,[id]:{...previous,requestId,pending:false,traceparent,error:axios.isAxiosError(error)?error.response?.data?.error??"Não foi possível salvar. Tente novamente.":"Falha ao salvar alteração"}}}));flow.flush("error")
   }).finally(()=>{inflight.delete(id)})
   inflight.set(id,request);return request
 }
}))
