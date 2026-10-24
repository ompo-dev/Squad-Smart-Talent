"use client"
import {create} from "zustand"
export const useTraceStore=create<{parents:Record<string,string>;remember:(id:string,parent:string)=>void}>(set=>({parents:{},remember:(id,parent)=>set(state=>({parents:Object.fromEntries([...Object.entries(state.parents).filter(([key])=>key!==id),[id,parent]].slice(-100))}))}))
