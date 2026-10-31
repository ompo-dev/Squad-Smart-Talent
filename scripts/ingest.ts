import {readFile} from "node:fs/promises"
import {prisma} from "../lib/prisma"
import {importTelemetry} from "../lib/application/import-telemetry"
try {console.log(JSON.stringify(await importTelemetry(await readFile(process.env.CSV_PATH??"data/machine_downtime.csv","utf8")),null,2))}finally{await prisma.$disconnect()}
