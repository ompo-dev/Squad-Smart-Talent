"use client"
import {create} from "zustand"
import axios from "axios"
import {startClientFlow} from "@/lib/observability/client"
export type TelemetryView={rows:{id:number;header:string;type:string;status:string;target:string;limit:string;reviewer:string}[];series:{date:string;desktop:number;mobile:number}[];stats?:{readings:number;machines:number;temperature:number;alerts:number}}
type Mode="latest"|"alerts"|"readings"
type State={generation:number;requests:Partial<Record<Mode,string>>;views:Partial<Record<Mode,TelemetryView>>;loading:Partial<Record<Mode,boolean>>;errors:Partial<Record<Mode,string>>;traceparent?:string;invalidate:()=>void;load:(mode:Mode)=>Promise<void>}
export const useTelemetryStore=create<State>((set,get)=>({generation:0,requests:{},views:{},loading:{},errors:{},invalidate:()=>set(state=>({generation:state.generation+1,views:{},loading:{},errors:{},requests:{}})),load:async(mode)=>{
 const generation=get().generation,request=crypto.randomUUID()
 const flow=startClientFlow("telemetry.read");flow.mark("zustand.load")
 set(state=>({requests:{...state.requests,[mode]:request},loading:{...state.loading,[mode]:true},errors:{...state.errors,[mode]:""}}))
 try {const {data,headers}=await axios.get<TelemetryView>(`/api/telemetry/view?mode=${mode}`,{headers:{traceparent:flow.header()}});if(get().generation!==generation||get().requests[mode]!==request){flow.flush();return}flow.serverParent(headers.traceparent);const parent=flow.mark("zustand.commit");set(state=>({views:{...state.views,[mode]:data},loading:{...state.loading,[mode]:false},traceparent:parent}));flow.flush()}
 catch(error){if(get().generation!==generation||get().requests[mode]!==request){flow.flush();return}flow.mark("zustand.rollback","error");set(state=>({loading:{...state.loading,[mode]:false},errors:{...state.errors,[mode]:"Não foi possível atualizar as leituras."}}));flow.flush("error")}
}}))
