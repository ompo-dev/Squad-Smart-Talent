import { pool } from "@/lib/agent-tools"
import type { Message, Thread } from "@openuidev/react-headless"

let ready: Promise<unknown> | undefined
export function ensureChatSchema() {
  return ready ??= pool.query(`CREATE TABLE IF NOT EXISTS chat_threads (
    id uuid PRIMARY KEY, title text NOT NULL, messages jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS chat_files (
    id uuid PRIMARY KEY, name text NOT NULL, media_type text NOT NULL, size integer NOT NULL,
    content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS telemetry_changes (
    id uuid PRIMARY KEY, reading_id integer NOT NULL, field text NOT NULL,
    before_value numeric, after_value numeric, reason text NOT NULL,
    status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz);`).catch((error) => { ready = undefined; throw error })
}
export async function listThreads(): Promise<Thread[]> {
  await ensureChatSchema()
  const result = await pool.query('SELECT id, title, created_at AS "createdAt" FROM chat_threads ORDER BY updated_at DESC LIMIT 100')
  return result.rows
}
export async function createThread(message: Message) {
  await ensureChatSchema()
  const title = (typeof message.content === "string" ? message.content : "Conversa com anexos").slice(0, 70)
  const result = await pool.query('INSERT INTO chat_threads(id,title,messages) VALUES($1,$2,$3) RETURNING id,title,created_at AS "createdAt"', [crypto.randomUUID(), title, JSON.stringify([message])])
  return result.rows[0] as Thread
}
export async function getMessages(id: string): Promise<Message[]> {
  await ensureChatSchema()
  const result = await pool.query("SELECT messages FROM chat_threads WHERE id=$1", [id])
  if (!result.rowCount) throw new Error("Conversa não encontrada")
  return result.rows[0].messages
}
export async function saveMessages(id: string, messages: Message[]) {
  await ensureChatSchema()
  await pool.query("UPDATE chat_threads SET messages=$2, updated_at=now() WHERE id=$1", [id, JSON.stringify(messages)])
}
