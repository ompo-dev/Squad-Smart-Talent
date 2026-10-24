"use client"
import {create} from "zustand"
export const useRealtimeStore=create<{connected:boolean;sequence:number;lastType?:string;lastId?:string;traceparent?:string;update:(connected:boolean,type?:string,id?:string,parent?:string)=>void}>(set=>({connected:false,sequence:0,update:(connected,type,id,parent)=>set(state=>({connected,sequence:type?state.sequence+1:state.sequence,lastType:type??state.lastType,lastId:id??state.lastId,traceparent:parent??state.traceparent}))}))
