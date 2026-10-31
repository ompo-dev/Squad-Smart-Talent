"""Prepara o Machine Downtime.csv em um banco SQLite limpo para a entrega da Aula 1.

Uso:
    python docs/entrega-aula-1/scripts/preparar_banco.py data/machine_downtime.csv docs/entrega-aula-1/dados/grupo4_machine_downtime.db
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

SENSORES = {
    "hydraulic_pressure_bar": (0, 300),
    "coolant_pressure_bar": (0, 20),
    "air_system_pressure_bar": (0, 20),
    "coolant_temperature_c": (0, 100),
    "hydraulic_oil_temperature_c": (0, 120),
    "spindle_bearing_temperature_c": (0, 120),
    "spindle_vibration_um": (0, 20),
    "tool_vibration_um": (0, 100),
    "spindle_speed_rpm": (0, 40000),
    "voltage_v": (0, 600),
    "torque_nm": (0, 200),
    "cutting_kn": (0, 50),
}

ALIASES = {
    "date": "date",
    "machine_id": "machine_id",
    "assembly_line_no": "assembly_line",
    "hydraulic_pressure": "hydraulic_pressure_bar",
    "hydraulic_pressure_bar": "hydraulic_pressure_bar",
    "coolant_pressure": "coolant_pressure_bar",
    "coolant_pressure_bar": "coolant_pressure_bar",
    "air_system_pressure": "air_system_pressure_bar",
    "air_system_pressure_bar": "air_system_pressure_bar",
    "coolant_temperature": "coolant_temperature_c",
    "coolant_temperature_c": "coolant_temperature_c",
    "hydraulic_oil_temperature": "hydraulic_oil_temperature_c",
    "hydraulic_oil_temperature_c": "hydraulic_oil_temperature_c",
    "spindle_bearing_temperature": "spindle_bearing_temperature_c",
    "spindle_bearing_temperature_c": "spindle_bearing_temperature_c",
    "spindle_vibration": "spindle_vibration_um",
    "spindle_vibration_m": "spindle_vibration_um",
    "spindle_vibration_um": "spindle_vibration_um",
    "tool_vibration": "tool_vibration_um",
    "tool_vibration_m": "tool_vibration_um",
    "tool_vibration_um": "tool_vibration_um",
    "spindle_speed": "spindle_speed_rpm",
    "spindle_speed_rpm": "spindle_speed_rpm",
    "voltage": "voltage_v",
    "voltage_volts": "voltage_v",
    "voltage_v": "voltage_v",
    "torque": "torque_nm",
    "torque_nm": "torque_nm",
    "cutting": "cutting_kn",
    "cutting_kn": "cutting_kn",
    "downtime": "downtime",
}

SENTINELS = {"", "na", "n/a", "nan", "null", "none", "sem dado", "-", "--", "undefined"}


def header_key(value: str) -> str:
    text = re.sub(r"\([^)]*\)", " ", value)
    return re.sub(r"[^a-z0-9]", "", text.lower())


HEADER_LOOKUP = {header_key(alias): field for alias, field in ALIASES.items()}


def parse_number(raw: object, minimum: float, maximum: float) -> float | None:
    text = str(raw or "").strip().replace("\u00a0", " ").replace("−", "-")
    if not text or text.lower() in SENTINELS:
        return None
    text = re.sub(r"\s*(?:°\s*c|c|psi|bar|rpm|mm\s*/\s*s|µm|um|nm|kn|v|volts?|h|horas?)\s*$", "", text, flags=re.I)
    text = text.replace(" ", "")
    if not text or text.lower() in SENTINELS:
        return None
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".") if text.rfind(",") > text.rfind(".") else text.replace(",", "")
    elif "," in text:
        text = text.replace(",", "") if re.fullmatch(r"-?\d{1,3}(?:,\d{3}){2,}", text) else text.replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(?:\.\d{3}){2,}", text):
        text = text.replace(".", "")
    try:
        number = float(text)
    except ValueError:
        return None
    if number == 0 or number < 0 or number < minimum or number > maximum:
        return None
    return number


def parse_date(raw: object) -> str | None:
    text = str(raw or "").strip()
    if not text:
        return None
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc).isoformat(timespec="seconds")
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.astimezone(timezone.utc).isoformat(timespec="seconds")
    except ValueError:
        return None


def parse_downtime(raw: object) -> tuple[int | None, str | None]:
    text = str(raw or "").strip()
    if not text:
        return None, None
    key = re.sub(r"[^a-z0-9]", "", text.lower())
    if key in {"machinefailure", "falha", "falhamaquina", "true", "1", "sim", "yes"}:
        return 1, text
    if key in {"nomachinefailure", "semfalha", "false", "0", "nao", "no"}:
        return 0, text
    return None, text


def record_key(reading: dict[str, object]) -> str:
    canonical = [
        reading["date"], reading["machine_id"], reading["assembly_line"],
        *[reading[field] for field in SENSORES], reading["downtime"],
    ]
    return hashlib.sha256(json.dumps(canonical, ensure_ascii=False).encode("utf-8")).hexdigest()[:32]


def build(input_path: Path, output_path: Path) -> dict[str, int]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()
    connection = sqlite3.connect(output_path)
    connection.executescript(
        """
        PRAGMA foreign_keys = OFF;
        CREATE TABLE telemetria_suja (
            id_registro_bruto INTEGER PRIMARY KEY,
            date TEXT, machine_id TEXT, assembly_line TEXT,
            hydraulic_pressure_bar TEXT, coolant_pressure_bar TEXT,
            air_system_pressure_bar TEXT, coolant_temperature_c TEXT,
            hydraulic_oil_temperature_c TEXT, spindle_bearing_temperature_c TEXT,
            spindle_vibration_um TEXT, tool_vibration_um TEXT, spindle_speed_rpm TEXT,
            voltage_v TEXT, torque_nm TEXT, cutting_kn TEXT, downtime TEXT
        );
        CREATE TABLE dim_maquina (
            machine_id TEXT PRIMARY KEY NOT NULL,
            assembly_line TEXT NOT NULL,
            leituras INTEGER NOT NULL,
            paradas INTEGER NOT NULL,
            taxa_parada REAL NOT NULL,
            temperatura_refrigerante_media_c REAL,
            vibracao_spindle_media_um REAL
        );
        CREATE TABLE telemetria_limpa (
            record_key TEXT PRIMARY KEY NOT NULL,
            machine_id TEXT NOT NULL,
            assembly_line TEXT NOT NULL,
            date TEXT NOT NULL,
            hydraulic_pressure_bar REAL, coolant_pressure_bar REAL,
            air_system_pressure_bar REAL, coolant_temperature_c REAL,
            hydraulic_oil_temperature_c REAL, spindle_bearing_temperature_c REAL,
            spindle_vibration_um REAL, tool_vibration_um REAL, spindle_speed_rpm REAL,
            voltage_v REAL, torque_nm REAL, cutting_kn REAL,
            downtime INTEGER, downtime_label TEXT, quality_issues TEXT,
            perda_leitura INTEGER NOT NULL DEFAULT 0,
            def_parada INTEGER NOT NULL DEFAULT 0,
            def_temperatura_critica INTEGER NOT NULL DEFAULT 0,
            def_vibracao_critica INTEGER NOT NULL DEFAULT 0,
            def_pressao_critica INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (machine_id) REFERENCES dim_maquina(machine_id)
        );
        CREATE TABLE fato_ocorrencia (
            id_ocorrencia INTEGER PRIMARY KEY AUTOINCREMENT,
            record_key TEXT NOT NULL,
            machine_id TEXT NOT NULL,
            tipo_ocorrencia TEXT NOT NULL,
            FOREIGN KEY (record_key) REFERENCES telemetria_limpa(record_key),
            FOREIGN KEY (machine_id) REFERENCES dim_maquina(machine_id),
            UNIQUE (record_key, tipo_ocorrencia)
        );
        CREATE INDEX ix_leitura_maquina_data ON telemetria_limpa(machine_id, date);
        CREATE INDEX ix_fato_maquina ON fato_ocorrencia(machine_id);
        """
    )
    stats = {"recebidas": 0, "validas": 0, "invalidas": 0, "duplicadas": 0, "corrigidas": 0}
    seen: set[str] = set()
    with input_path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.reader(source)
        headers = next(reader)
        fields = [HEADER_LOOKUP.get(header_key(header)) for header in headers]
        for index, row in enumerate(reader, start=2):
            if not any(cell.strip() for cell in row):
                continue
            stats["recebidas"] += 1
            raw = {field: row[position] if position < len(row) else "" for position, field in enumerate(fields) if field}
            connection.execute(
                "INSERT INTO telemetria_suja VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                [index, *[raw.get(field, "") for field in ("date", "machine_id", "assembly_line", *SENSORES, "downtime")]],
            )
            date = parse_date(raw.get("date"))
            machine_id = (raw.get("machine_id") or "").strip()
            assembly_line = (raw.get("assembly_line") or "").strip()
            if not date or not machine_id or not assembly_line:
                stats["invalidas"] += 1
                continue
            reading: dict[str, object] = {"date": date, "machine_id": machine_id, "assembly_line": assembly_line}
            issues: list[str] = []
            for field, (minimum, maximum) in SENSORES.items():
                value = parse_number(raw.get(field), minimum, maximum)
                reading[field] = value
                if value is None:
                    issues.append(f"{field}: ausente ou corrigido")
                    stats["corrigidas"] += 1
            downtime, label = parse_downtime(raw.get("downtime"))
            reading["downtime"] = downtime
            reading["downtime_label"] = label
            key = record_key(reading)
            if key in seen:
                stats["duplicadas"] += 1
                continue
            seen.add(key)
            stats["validas"] += 1
            critical = {
                "def_parada": int(downtime == 1),
                "def_temperatura_critica": int(any(reading.get(field) is not None and reading[field] > limit for field, limit in (("coolant_temperature_c", 45), ("hydraulic_oil_temperature_c", 60), ("spindle_bearing_temperature_c", 47)))),
                "def_vibracao_critica": int(any(reading.get(field) is not None and reading[field] > limit for field, limit in (("spindle_vibration_um", 1.95), ("tool_vibration_um", 44)))),
                "def_pressao_critica": int(any(reading.get(field) is not None and (reading[field] < low or reading[field] > high) for field, low, high in (("hydraulic_pressure_bar", 40, 185), ("coolant_pressure_bar", 2, 9), ("air_system_pressure_bar", 4, 8)))),
            }
            perda = int(any(reading[field] is None for field in SENSORES))
            connection.execute(
                "INSERT INTO telemetria_limpa VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                [key, machine_id, assembly_line, date, *[reading[field] for field in SENSORES], downtime, label, " | ".join(issues), perda, *critical.values()],
            )
            for tipo, active in (("Parada", critical["def_parada"]), ("Temperatura crítica", critical["def_temperatura_critica"]), ("Vibração crítica", critical["def_vibracao_critica"]), ("Pressão crítica", critical["def_pressao_critica"])):
                if active:
                    connection.execute("INSERT INTO fato_ocorrencia(record_key,machine_id,tipo_ocorrencia) VALUES (?,?,?)", (key, machine_id, tipo))
    connection.execute(
        """
        INSERT INTO dim_maquina
        SELECT machine_id, MIN(assembly_line), COUNT(*), SUM(downtime),
               ROUND(1.0 * AVG(downtime), 4),
               ROUND(AVG(coolant_temperature_c), 2), ROUND(AVG(spindle_vibration_um), 3)
        FROM telemetria_limpa GROUP BY machine_id
        """
    )
    connection.commit()
    connection.execute("PRAGMA foreign_keys = ON")
    counts = {table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in ("telemetria_suja", "telemetria_limpa", "dim_maquina", "fato_ocorrencia")}
    connection.close()
    print(json.dumps({**stats, "tabelas": counts}, ensure_ascii=False, indent=2))
    return stats


if __name__ == "__main__":
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "data/machine_downtime.csv")
    destination = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/entrega-aula-1/dados/grupo4_machine_downtime.db")
    build(source, destination)
