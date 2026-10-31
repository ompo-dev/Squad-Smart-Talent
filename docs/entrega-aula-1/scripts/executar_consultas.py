"""Executa as cinco consultas da entrega e grava os resultados em CSV."""

from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "dados" / "grupo4_machine_downtime.db"
SQL_FILE = ROOT / "sql" / "02_cinco_consultas_SQLite.sql"
OUTPUT = ROOT / "resultados"


def queries() -> list[str]:
    lines = [line for line in SQL_FILE.read_text(encoding="utf-8").splitlines() if not line.strip().startswith("--")]
    return [statement.strip() for statement in "\n".join(lines).split(";") if statement.strip()]


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    for number, sql in enumerate(queries(), start=1):
        rows = connection.execute(sql).fetchall()
        target = OUTPUT / f"resultado_consulta_{number}.csv"
        with target.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle, delimiter=";")
            if rows:
                writer.writerow(rows[0].keys())
                writer.writerows([tuple(row) for row in rows])
        print(f"Consulta {number}: {len(rows)} linha(s) -> {target.relative_to(ROOT)}")
    connection.close()


if __name__ == "__main__":
    main()
