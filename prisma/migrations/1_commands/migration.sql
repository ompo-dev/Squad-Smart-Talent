CREATE TABLE command_receipts (id text PRIMARY KEY,type text NOT NULL,payload_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE chat_runs (id text PRIMARY KEY,thread_id uuid NOT NULL,payload_hash text NOT NULL,status text NOT NULL DEFAULT 'running',messages jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX telemetry_id_maquina_data_hora_idx ON telemetry(id_maquina,data_hora);
