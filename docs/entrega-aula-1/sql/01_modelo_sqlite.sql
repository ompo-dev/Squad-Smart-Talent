-- GRUPO 4 | SMART TALENT JOHN DEERE | MANUFATURA E EFICIENCIA (OEE)
-- SQLite 3 | Modelo relacional: bruto -> limpeza -> dimensao -> fatos
-- Executar antes da carga, em banco novo. IMPORTANTE: a tabela de dimensao
-- e populada a partir da selecao DISTINCT de maquinas no script de importacao.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS telemetria_suja (
  id_registro_bruto INTEGER PRIMARY KEY AUTOINCREMENT,
  id_leitura TEXT,
  id_maquina TEXT,
  data_hora TEXT,
  temp_motor_c TEXT,
  pressao_oleo_psi TEXT,
  rpm TEXT,
  vibracao_mm_s TEXT,
  consumo_l_h TEXT,
  horas_motor TEXT,
  turno TEXT
);

CREATE TABLE IF NOT EXISTS dim_maquina (
  id_maquina TEXT PRIMARY KEY NOT NULL,
  faixa_uso TEXT NOT NULL,
  horas_motor_atual REAL,
  consumo_medio_l_h REAL
);

CREATE TABLE IF NOT EXISTS telemetria_limpa (
  id_leitura TEXT PRIMARY KEY NOT NULL,
  id_maquina TEXT NOT NULL,
  data_hora TEXT NOT NULL, -- ISO 8601: YYYY-MM-DD HH:MM:SS
  turno TEXT NOT NULL CHECK (turno IN ('A','B','C')),
  temp_motor_c REAL,
  pressao_oleo_psi REAL,
  rpm REAL,
  vibracao_mm_s REAL,
  consumo_l_h REAL,
  horas_motor REAL,
  def_superaquecimento INTEGER NOT NULL DEFAULT 0 CHECK (def_superaquecimento IN (0,1)),
  def_pressao_baixa INTEGER NOT NULL DEFAULT 0 CHECK (def_pressao_baixa IN (0,1)),
  def_vibracao_alta INTEGER NOT NULL DEFAULT 0 CHECK (def_vibracao_alta IN (0,1)),
  perda_leitura INTEGER NOT NULL DEFAULT 0 CHECK (perda_leitura IN (0,1)),
  UNIQUE (id_leitura, id_maquina),
  FOREIGN KEY (id_maquina) REFERENCES dim_maquina(id_maquina)
);

CREATE TABLE IF NOT EXISTS fato_ocorrencia (
  id_ocorrencia INTEGER PRIMARY KEY AUTOINCREMENT,
  id_leitura TEXT NOT NULL,
  id_maquina TEXT NOT NULL,
  tipo_ocorrencia TEXT NOT NULL
    CHECK (tipo_ocorrencia IN ('Superaquecimento','Pressão baixa','Vibração alta','Perda de leitura')),
  FOREIGN KEY (id_leitura, id_maquina)
    REFERENCES telemetria_limpa(id_leitura, id_maquina),
  FOREIGN KEY (id_maquina) REFERENCES dim_maquina(id_maquina),
  UNIQUE (id_leitura, tipo_ocorrencia)
);

CREATE TABLE IF NOT EXISTS rejeicoes_importacao (
  id_rejeicao INTEGER PRIMARY KEY AUTOINCREMENT,
  linha_csv INTEGER NOT NULL,
  id_leitura TEXT,
  motivo TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_leitura_maquina_data ON telemetria_limpa(id_maquina, data_hora);
CREATE INDEX IF NOT EXISTS ix_leitura_turno ON telemetria_limpa(turno);
CREATE INDEX IF NOT EXISTS ix_fato_maquina ON fato_ocorrencia(id_maquina);
CREATE INDEX IF NOT EXISTS ix_fato_tipo ON fato_ocorrencia(tipo_ocorrencia);
