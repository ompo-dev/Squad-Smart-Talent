import {readFile} from "node:fs/promises"
import {spawnSync} from "node:child_process"
import {prisma} from "../lib/prisma"
const cli=(...args:string[])=>{const result=spawnSync(process.execPath,["node_modules/prisma/build/index.js",...args],{stdio:"inherit",env:process.env});if(result.status!==0)throw new Error("Migração Prisma falhou")}
try {
 const [state]=await prisma.$queryRaw<{telemetry:string|null;history:string|null}[]>`SELECT to_regclass('public.telemetry')::text AS telemetry,to_regclass('public._prisma_migrations')::text AS history`
 if(state.telemetry&&!state.history){
   const baseline=await readFile(new URL("../prisma/migrations/0_baseline/migration.sql",import.meta.url),"utf8")
   for(const statement of baseline.split(";").filter(sql=>sql.trim()))await prisma.$executeRawUnsafe(statement)
   cli("migrate","resolve","--applied","0_baseline")
 }
 cli("migrate","deploy")
} finally {await prisma.$disconnect()}
