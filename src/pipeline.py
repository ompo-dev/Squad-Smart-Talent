#!/usr/bin/env python3
"""Pipeline acadêmico independente para limpeza de telemetria usando Pandas.

Reproduz as regras de lib/telemetry-schema.ts e
lib/application/import-telemetry.ts sem iniciar Next.js, PostgreSQL ou Redis.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

import pandas as pd

ISSUES_SEPARATOR = " | "  # separador de quality_issues no CSV exportado

# Limites físicos e ordem canônica copiados do schema TypeScript.
SENSORS: dict[str, tuple[float, float]] = {
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
SENSOR_SHORT_LABELS = {
    "hydraulic_pressure_bar": "Pressão hidr.",
    "coolant_pressure_bar": "Pressão refr.",
    "air_system_pressure_bar": "Pressão ar",
    "coolant_temperature_c": "Temp. refr.",
    "hydraulic_oil_temperature_c": "Temp. óleo",
    "spindle_bearing_temperature_c": "Temp. mancal",
    "spindle_vibration_um": "Vib. spindle",
    "tool_vibration_um": "Vib. ferramenta",
    "spindle_speed_rpm": "Rotação",
    "voltage_v": "Tensão",
    "torque_nm": "Torque",
    "cutting_kn": "Corte",
}
ISSUE_LABELS = {
    "missing": "ausente", "sentinel": "sentinela", "zero": "zero tratado como ausente",
    "negative": "negativo tratado como ausente", "outOfRange": "fora da faixa física",
    "outlier": "outlier estatístico",
}

# Cada alias é normalizado pela mesma regra usada em headerKey() no TypeScript.
ALIASES: dict[str, str] = {}
def _add_alias(field: str, *aliases: str) -> None:
    for alias in aliases:
        ALIASES[normalize_header(alias)] = field

def normalize_header(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\([^)]*\)", " ", text).lower()
    return re.sub(r"[^a-z0-9]", "", text)

_add_alias("date", "date", "data", "timestamp", "datetime", "data_hora", "data e hora", "hora")
_add_alias("machine_id", "machine_id", "machineid", "machine", "id_maquina", "maquina", "máquina", "equipamento")
_add_alias("assembly_line", "assembly_line_no", "assembly_line", "assemblyline", "assemblylineno", "linha", "linha_montagem", "linha de montagem")
_add_alias("downtime", "downtime", "machine_failure", "machinefailure", "falha", "parada", "falha_maquina")
for field, aliases in {
    "hydraulic_pressure_bar": ("hydraulic_pressure_bar", "hydraulic_pressure", "hydraulicpressurebar", "hydraulicpressure", "pressao_hidraulica", "pressão hidráulica"),
    "coolant_pressure_bar": ("coolant_pressure_bar", "coolant_pressure", "coolantpressurebar", "coolantpressure", "pressao_refrigerante", "pressão do refrigerante"),
    "air_system_pressure_bar": ("air_system_pressure_bar", "air_system_pressure", "airsystempressurebar", "airsystempressure", "pressao_ar", "pressão do ar"),
    "coolant_temperature_c": ("coolant_temperature", "coolant_temperature_c", "coolanttemperature", "coolanttemperaturec", "temperatura_refrigerante", "temperatura do refrigerante"),
    "hydraulic_oil_temperature_c": ("hydraulic_oil_temperature", "hydraulic_oil_temperature_c", "hydraulicoiltemperature", "hydraulicoiltemperaturec", "temperatura_oleo_hidraulico", "temperatura do óleo hidráulico"),
    "spindle_bearing_temperature_c": ("spindle_bearing_temperature", "spindle_bearing_temperature_c", "spindlebearingtemperature", "spindlebearingtemperaturec", "temperatura_mancal", "temperatura do mancal"),
    "spindle_vibration_um": ("spindle_vibration", "spindle_vibration_um", "spindlevibration", "spindlevibrationm", "spindlevibrationum", "vibracao_spindle", "vibração do spindle"),
    "tool_vibration_um": ("tool_vibration", "tool_vibration_um", "toolvibration", "toolvibrationm", "toolvibrationum", "vibracao_ferramenta", "vibração da ferramenta"),
    "spindle_speed_rpm": ("spindle_speed", "spindle_speed_rpm", "spindlespeed", "spindlespeedrpm", "rotacao", "rotação"),
    "voltage_v": ("voltage", "voltage_v", "voltagevolts", "volts", "tensao", "tensão"),
    "torque_nm": ("torque", "torque_nm", "torquenm"),
    "cutting_kn": ("cutting", "cutting_kn", "cuttingkn", "forca_corte", "força de corte"),
}.items():
    _add_alias(field, *aliases)

SENTINELS = {"", "na", "n/a", "nan", "null", "none", "sem dado", "-", "--", "undefined"}
TRUE_LABELS = {"machine_failure", "machine failure", "falha", "falha_maquina", "falha na maquina", "true", "1", "sim", "yes"}
FALSE_LABELS = {"no_machine_failure", "no machine_failure", "no machine failure", "sem falha", "sem_falha", "false", "0", "nao", "não", "no"}


def read_csv(path: Path) -> pd.DataFrame:
    """Lê CSV preservando strings para aplicar conversões explicitamente."""
    return pd.read_csv(path, sep=None, engine="python", dtype=str,
                       keep_default_na=False, encoding="utf-8-sig", on_bad_lines="error")


def parse_number(raw: object, limits: tuple[float, float]) -> tuple[float | None, str | None]:
    """Equivalente ao parseSensorNumber do TypeScript."""
    text = str(raw if raw is not None else "").strip()
    text = text.replace("\u00a0", " ").replace("−", "-").replace("–", "-").replace("—", "-")
    if not text or text.lower() in SENTINELS:
        return None, "missing"
    text = re.sub(r"\s*(?:°\s*c|c|psi|bar|rpm|mm\s*/\s*s|µm|um|nm|kn|v|volts?|h|horas?)\s*$", "", text, flags=re.I)
    text = re.sub(r"\s", "", text)
    if not text or text.lower() in SENTINELS:
        return None, "missing"
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".") if text.rfind(",") > text.rfind(".") else text.replace(",", "")
    elif "," in text:
        text = text.replace(",", "") if re.fullmatch(r"-?\d{1,3}(?:,\d{3}){2,}", text) else text.replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(?:\.\d{3}){2,}", text):
        text = text.replace(".", "")
    if not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", text):
        return None, "missing"
    try:
        number = float(text)
    except ValueError:
        return None, "missing"
    if not math.isfinite(number):
        return None, "missing"
    if abs(number) >= 1e9:
        return None, "sentinel"
    minimum, maximum = limits
    if number == 0:
        return None, "zero"
    if number < 0:
        return None, "negative"
    if number < minimum or number > maximum:
        return None, "outOfRange"
    return number, None


def parse_date(raw: object) -> pd.Timestamp | None:
    """Aceita os formatos explicitamente aceitos pelo parser TypeScript; UTC."""
    text = str(raw if raw is not None else "").strip()
    if not text:
        return None
    zoned = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?(Z|[+-]\d{2}:?\d{2})", text)
    iso = re.fullmatch(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?", text)
    local = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?", text)
    if zoned:
        try:
            result = pd.Timestamp(text.replace("Z", "+00:00"))
            return result.tz_convert("UTC")
        except (ValueError, TypeError):
            return None
    if iso:
        year, month, day = map(int, iso.group(1, 2, 3))
        time_parts = iso.group(4, 5, 6, 7)
    elif local:
        day, month, year = map(int, local.group(1, 2, 3))
        time_parts = local.group(4, 5, 6, 7)
    else:
        return None
    hour, minute, second = (int(time_parts[i] or 0) for i in range(3))
    millis = int((time_parts[3] or "0").ljust(3, "0"))
    try:
        return pd.Timestamp(year=year, month=month, day=day, hour=hour,
                            minute=minute, second=second, microsecond=millis * 1000, tz="UTC")
    except (ValueError, TypeError):
        return None


def parse_label(raw: object) -> tuple[bool | None, str | None, str | None]:
    label = str(raw if raw is not None else "").strip()
    if not label:
        return None, None, "missingLabel"
    key = unicodedata.normalize("NFD", label).replace("\u00a0", " ")
    key = "".join(ch for ch in key if unicodedata.category(ch) != "Mn").lower()
    if key in TRUE_LABELS:
        return True, label, None
    if key in FALSE_LABELS:
        return False, label, None
    return None, label, "missingLabel"


def _js_number(value: int | float) -> str:
    """Formata números como JSON.stringify (notação decimal/exponencial JS)."""
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("JSON não aceita NaN ou infinito")
    if number == 0:
        return "0"  # JSON.stringify(-0) também produz 0.
    if number.is_integer() and abs(number) < 1e21:
        return str(int(number))
    raw = repr(number).lower()
    if "e" not in raw:
        return raw
    mantissa, exponent_text = raw.split("e", 1)
    exponent = int(exponent_text)
    # ECMAScript usa decimal entre 1e-6 (inclusive) e 1e21 (exclusive).
    if 1e-6 <= abs(number) < 1e21:
        from decimal import Decimal
        decimal_text = format(Decimal(raw), "f")
        return decimal_text.rstrip("0").rstrip(".") if "." in decimal_text else decimal_text
    sign = "+" if exponent >= 0 else ""
    return f"{mantissa}e{sign}{exponent}"


def js_json_dumps(value: Any) -> str:
    """Serializa o array canônico de forma compatível com JSON.stringify."""
    if isinstance(value, list):
        parts = []
        for item in value:
            if item is None:
                parts.append("null")
            elif item is True:
                parts.append("true")
            elif item is False:
                parts.append("false")
            elif isinstance(item, (int, float)):
                parts.append(_js_number(item))
            elif isinstance(item, str):
                parts.append(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
            else:
                raise TypeError(f"Tipo não suportado na chave canônica: {type(item).__name__}")
        return "[" + ",".join(parts) + "]"
    raise TypeError("A serialização canônica espera uma lista")


def make_record_key(record: dict[str, Any]) -> str:
    timestamp = record["date"].strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    values: list[Any] = [timestamp, record["machine_id"], record["assembly_line"]]
    for sensor in SENSORS:
        value = record.get(sensor)
        values.append(None if value is None or pd.isna(value) else (int(value) if float(value).is_integer() else float(value)))
    values.append(record.get("downtime"))
    return hashlib.sha256(js_json_dumps(values).encode("utf-8")).hexdigest()[:32]


def run_pipeline(input_path: Path, output_dir: Path) -> dict[str, Any]:
    if not input_path.is_file():
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {input_path}")
    if input_path.stat().st_size == 0:
        raise ValueError(f"O arquivo de entrada está vazio: {input_path}")
    raw = read_csv(input_path)
    if raw.empty:
        raise ValueError("O CSV precisa conter cabeçalho e ao menos uma leitura.")
    header_map: dict[str, str] = {}
    for original in raw.columns:
        canonical = ALIASES.get(normalize_header(original))
        if canonical is None:
            continue
        if canonical in header_map:
            raise ValueError(f"Duas colunas representam {canonical}: {header_map[canonical]} e {original}")
        header_map[canonical] = original
    required = ["date", "machine_id", "assembly_line"]
    missing_required = [field for field in required if field not in header_map]
    if missing_required:
        raise ValueError("Colunas obrigatórias ausentes: " + ", ".join(missing_required))

    counts = {"received": len(raw), "valid": 0, "invalid": 0, "duplicates": 0,
              "missingCells": 0, "zeroCells": 0, "negativeCells": 0,
              "outOfRangeCells": 0, "outlierCells": 0, "missingLabels": 0,
              "repairedCells": 0, "repairedRows": 0, "rowsWithoutSensors": 0}
    records: list[dict[str, Any]] = []
    errors: list[str] = []
    seen: set[str] = set()
    for row_number, (_, source) in enumerate(raw.iterrows(), start=2):
        date = parse_date(source.get(header_map["date"], ""))
        machine = str(source.get(header_map["machine_id"], "")).strip()[:120]
        line = str(source.get(header_map["assembly_line"], "")).strip()[:80]
        missing = []
        if date is None: missing.append("data")
        if not machine: missing.append("máquina")
        if not line: missing.append("linha de montagem")
        if missing:
            counts["invalid"] += 1
            if len(errors) < 5:
                errors.append(f"Linha {row_number}: campos obrigatórios inválidos: {', '.join(missing)}")
            continue

        record: dict[str, Any] = {"date": date, "machine_id": machine, "assembly_line": line}
        issues: list[str] = []
        valid_sensors = 0
        for sensor, limits in SENSORS.items():
            original = header_map.get(sensor)
            value, issue = parse_number(source.get(original, "") if original else "", limits)
            record[sensor] = value
            if value is not None:
                valid_sensors += 1
            if issue:
                counter = "missingCells" if issue in ("missing", "sentinel") else {
                    "zero": "zeroCells", "negative": "negativeCells", "outOfRange": "outOfRangeCells"}[issue]
                counts[counter] += 1
                counts["repairedCells"] += 1
                issues.append(f"{SENSOR_SHORT_LABELS[sensor]}: {ISSUE_LABELS[issue]}")
        downtime, label, label_issue = parse_label(source.get(header_map["downtime"], "") if "downtime" in header_map else "")
        record["downtime"] = downtime
        record["downtime_label"] = label
        if label_issue:
            counts["missingLabels"] += 1
            issues.append("Parada: rótulo de parada ausente")
        if valid_sensors == 0:
            counts["rowsWithoutSensors"] += 1
            issues.append("sem sensores")
        record["quality_issues"] = issues
        key = make_record_key(record)
        if key in seen:
            counts["duplicates"] += 1
            continue
        seen.add(key)
        if issues:
            counts["repairedRows"] += 1
        counts["valid"] += 1
        record["record_key"] = key
        records.append(record)

    if not records:
        raise ValueError("Nenhuma leitura válida no arquivo.")
    clean = pd.DataFrame(records)

    # Mesmo quantil linear (posição (n-1)*p) e limiar Q1-3*IQR/Q3+3*IQR.
    for sensor in SENSORS:
        values = clean[sensor].dropna().sort_values()
        if len(values) < 8:
            continue
        q1, q3 = values.quantile([0.25, 0.75], interpolation="linear")
        iqr = q3 - q1
        if iqr <= 0:
            continue
        mask = clean[sensor].notna() & ((clean[sensor] < q1 - 3 * iqr) | (clean[sensor] > q3 + 3 * iqr))
        counts["outlierCells"] += int(mask.sum())
        for idx in clean.index[mask]:
            clean.at[idx, "quality_issues"].append(f"{SENSOR_SHORT_LABELS[sensor]}: outlier estatístico")

    clean = clean.sort_values(["date", "machine_id", "record_key"]).reset_index(drop=True)
    clean["date"] = clean["date"].map(lambda value: value.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z")
    sensor_columns = list(SENSORS)
    clean["readings_incomplete"] = clean[sensor_columns].isna().any(axis=1)
    known = clean["downtime"].notna()
    # O rótulo original é mantido para auditoria; desconhecido continua null.
    summary_columns = {
        "readings": ("record_key", "count"),
        "known_labels": ("downtime", "count"),
        "failures": ("downtime", lambda values: int((values == True).sum())),
        "incomplete_readings": ("readings_incomplete", "sum"),
    }
    summary_machine = clean.groupby(["machine_id", "assembly_line"], dropna=False).agg(**summary_columns).reset_index()
    summary_line = clean.groupby("assembly_line", dropna=False).agg(**summary_columns).reset_index()
    for summary in (summary_machine, summary_line):
        known_labels = summary["known_labels"].astype(float).where(summary["known_labels"] > 0)  # 0 vira NaN (sem divisão por zero)
        summary["failure_rate_known_labels_pct"] = (summary["failures"] / known_labels * 100).round(2)

    output_dir.mkdir(parents=True, exist_ok=True)
    export = clean.copy()
    # Lista Python não é legível em CSV/Excel: exporta como texto separado por " | " (vazio = sem problemas).
    export["quality_issues"] = export["quality_issues"].apply(lambda issues: ISSUES_SEPARATOR.join(issues))
    export.to_csv(output_dir / "telemetry_clean.csv", index=False, encoding="utf-8-sig")
    summary_machine.to_csv(output_dir / "summary_by_machine.csv", index=False, encoding="utf-8-sig")
    summary_line.to_csv(output_dir / "summary_by_line.csv", index=False, encoding="utf-8-sig")
    report: dict[str, Any] = {
        **counts, "input_file": str(input_path), "output_rows": len(clean), "errors": errors,
        "failure_rate_denominator": "somente leituras com downtime conhecido (True ou False)",
        "unknown_labels_excluded_from_failure_rate": int((~known).sum()),
        "outliers_policy": "sinalizados por IQR x 3; valores mantidos",
        "incomplete_readings_policy": "mantidas; uma leitura não é excluída por sensor ausente",
        "duplicate_policy": "chave SHA-256 dos campos limpos; primeiros registros mantidos",
        "sort_order": ["date", "machine_id", "record_key"],
    }
    (output_dir / "quality_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))

    # Gera��o dos gr�ficos conclusivos da Task 2
    try:
        try:
            from src.graficos import gerar_graficos
        except ImportError:
            from graficos import gerar_graficos
        titulos = gerar_graficos(clean, output_dir)
        for chave, titulo in titulos.items():
            try:
                print(f"Gr�fico gerado ({chave}): {titulo}")
            except UnicodeEncodeError:
                print(f"Grafico gerado ({chave})")
    except Exception as erro:
        print(f"Aviso: gera��o de gr�ficos n�o executada: {erro}", file=sys.stderr)

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Limpa telemetria industrial com Pandas, sem serviços externos.")
    parser.add_argument("--input", required=True, help="Caminho do CSV original")
    parser.add_argument("--output", required=True, help="Pasta para os arquivos gerados")
    args = parser.parse_args()
    try:
        run_pipeline(Path(args.input), Path(args.output))
    except (OSError, ValueError, csv.Error, pd.errors.ParserError, pd.errors.EmptyDataError) as error:
        # OSError: arquivo ausente/sem permissão; csv.Error: delimitador indetectável (CSV vazio); ValueError: dados inválidos ou ambíguos
        # (UnicodeDecodeError também é ValueError). Mensagem legível e código de saída 1, sem traceback.
        print(f"Erro: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
