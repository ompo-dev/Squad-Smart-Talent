-- Modelo SQLite da entrega Aula 1 · Machine Downtime
-- Fonte: data/machine_downtime.csv (2.500 leituras, 3 máquinas, 3 linhas).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS telemetria_suja (
  id_registro_bruto INTEGER PRIMARY KEY,
  date TEXT,
  machine_id TEXT,
  assembly_line TEXT,
  hydraulic_pressure_bar TEXT,
  coolant_pressure_bar TEXT,
  air_system_pressure_bar TEXT,
  coolant_temperature_c TEXT,
  hydraulic_oil_temperature_c TEXT,
  spindle_bearing_temperature_c TEXT,
  spindle_vibration_um TEXT,
  tool_vibration_um TEXT,
  spindle_speed_rpm TEXT,
  voltage_v TEXT,
  torque_nm TEXT,
  cutting_kn TEXT,
  downtime TEXT
);

CREATE TABLE IF NOT EXISTS dim_maquina (
  machine_id TEXT PRIMARY KEY NOT NULL,
  assembly_line TEXT NOT NULL,
  leituras INTEGER NOT NULL,
  paradas INTEGER NOT NULL,
  taxa_parada REAL NOT NULL,
  temperatura_refrigerante_media_c REAL,
  vibracao_spindle_media_um REAL
);

CREATE TABLE IF NOT EXISTS telemetria_limpa (
  record_key TEXT PRIMARY KEY NOT NULL,
  machine_id TEXT NOT NULL,
  assembly_line TEXT NOT NULL,
  date TEXT NOT NULL, -- ISO 8601 em UTC
  hydraulic_pressure_bar REAL,
  coolant_pressure_bar REAL,
  air_system_pressure_bar REAL,
  coolant_temperature_c REAL,
  hydraulic_oil_temperature_c REAL,
  spindle_bearing_temperature_c REAL,
  spindle_vibration_um REAL,
  tool_vibration_um REAL,
  spindle_speed_rpm REAL,
  voltage_v REAL,
  torque_nm REAL,
  cutting_kn REAL,
  downtime INTEGER,
  downtime_label TEXT,
  quality_issues TEXT,
  perda_leitura INTEGER NOT NULL DEFAULT 0,
  def_parada INTEGER NOT NULL DEFAULT 0,
  def_temperatura_critica INTEGER NOT NULL DEFAULT 0,
  def_vibracao_critica INTEGER NOT NULL DEFAULT 0,
  def_pressao_critica INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (machine_id) REFERENCES dim_maquina(machine_id)
);

CREATE TABLE IF NOT EXISTS fato_ocorrencia (
  id_ocorrencia INTEGER PRIMARY KEY AUTOINCREMENT,
  record_key TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  tipo_ocorrencia TEXT NOT NULL,
  FOREIGN KEY (record_key) REFERENCES telemetria_limpa(record_key),
  FOREIGN KEY (machine_id) REFERENCES dim_maquina(machine_id),
  UNIQUE (record_key, tipo_ocorrencia)
);

CREATE INDEX IF NOT EXISTS ix_leitura_maquina_data ON telemetria_limpa(machine_id, date);
CREATE INDEX IF NOT EXISTS ix_fato_maquina ON fato_ocorrencia(machine_id);
