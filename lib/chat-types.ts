export type ToolResult = {
  id: string
  name: string
  args: Record<string, unknown>
  data: { rows?: Record<string, unknown>[]; series?: { date: string; desktop: number; mobile: number }[]; summary?: Record<string, unknown>; columns?: string[]; description?: string; error?: string; change?: {id:string;readingId:number;field:string;before:number|null;after:number|null;status:string} }
}
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; format?: "openui" | "markdown"; tools?: ToolResult[]; error?: boolean }
export type ChatEvent =
  | { type: "status"; message: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; result: ToolResult }
  | { type: "answer"; content: string; format: "openui" | "markdown" }
  | { type: "answer_delta"; delta:string }
  | { type: "error"; message: string }
