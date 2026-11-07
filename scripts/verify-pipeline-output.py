#!/usr/bin/env python3
"""Verifica os artefatos produzidos pelo pipeline Pandas sem depender do Pandas."""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path


REQUIRED_FILES = (
    "telemetry_clean.csv",
    "summary_by_machine.csv",
    "summary_by_line.csv",
    "quality_report.json",
)


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    output = Path(sys.argv[1] if len(sys.argv) > 1 else "reports/pandas")
    missing = [name for name in REQUIRED_FILES if not (output / name).is_file() or (output / name).stat().st_size == 0]
    if missing:
        raise SystemExit(f"Artefatos ausentes ou vazios: {', '.join(missing)}")

    clean = read_rows(output / "telemetry_clean.csv")
    if not clean or "record_key" not in clean[0] or any(not row["record_key"] for row in clean):
        raise SystemExit("telemetry_clean.csv deve conter leituras e record_key em todas elas")
    if len({row["record_key"] for row in clean}) != len(clean):
        raise SystemExit("telemetry_clean.csv contém record_key duplicado")

    with (output / "quality_report.json").open(encoding="utf-8") as handle:
        report = json.load(handle)
    if report.get("output_rows") != len(clean) or report.get("valid") != len(clean):
        raise SystemExit("quality_report.json diverge da quantidade de leituras limpas")
    for name in ("summary_by_machine.csv", "summary_by_line.csv"):
        if not read_rows(output / name):
            raise SystemExit(f"{name} não contém dados")
    print(json.dumps({"output": str(output), "rows": len(clean), "status": "valid"}))


if __name__ == "__main__":
    main()
