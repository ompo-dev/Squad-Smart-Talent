import type {TelemetryQualitySummary} from "@/lib/application/import-telemetry"

export type TelemetryImportResult={received:number;valid:number;inserted:number;existing:number;duplicates:number;invalid:number;errors:string[];quality?:TelemetryQualitySummary}
export type AttachmentImportStatus={status:"pending"|"queued"|"running"|"completed"|"failed";jobId?:string;result?:TelemetryImportResult;error?:string}
export type TelemetryImportPreview={
  fileId:string;name:string;hash:string;received:number;valid:number;duplicates:number;invalid:number;errors:string[];quality:TelemetryQualitySummary
  sample:{recordKey:string;machineId:string;assemblyLine:string;timestamp:string;status:string;coolantTemperature:number|null;spindleVibration:number|null;downtime:boolean|null}[]
}
export type ToolResult = {
  id: string
  name: string
  args: Record<string, unknown>
  data: { rows?: Record<string, unknown>[]; series?: { date: string; desktop: number; mobile: number }[]; summary?: Record<string, unknown>; columns?: string[]; description?: string; error?: string; importPreview?:TelemetryImportPreview; change?: {id:string;readingId:number;field:string;before:number|null;after:number|null;status:string}; academicSpec?: Record<string, unknown> }
}
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; format?: "openui" | "markdown"; tools?: ToolResult[]; error?: boolean }
export type ChatEvent =
  | { type: "status"; message: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; result: ToolResult }
  | { type: "answer"; content: string; format: "openui" | "markdown" }
  | { type: "answer_delta"; delta:string }
  | { type: "error"; message: string }
