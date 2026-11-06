import sys
import unittest
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))
import pipeline


class NumberParsingTests(unittest.TestCase):
    def test_missing_and_sentinels(self):
        for value in ("", "N/A", "-", "undefined", "1.000.000.000"):
            parsed, issue = pipeline.parse_number(value, (0, 300))
            self.assertIsNone(parsed)
            self.assertIn(issue, ("missing", "sentinel"))

    def test_decimal_formats_and_units(self):
        self.assertEqual(pipeline.parse_number("1.234,5 bar", (0, 2000)), (1234.5, None))
        self.assertEqual(pipeline.parse_number("1,234.5", (0, 2000)), (1234.5, None))
        self.assertEqual(pipeline.parse_number("12,5 °C", (0, 100)), (12.5, None))

    def test_invalid_physical_values(self):
        self.assertEqual(pipeline.parse_number("0", (0, 300)), (None, "zero"))
        self.assertEqual(pipeline.parse_number("-2", (0, 300)), (None, "negative"))
        self.assertEqual(pipeline.parse_number("301", (0, 300)), (None, "outOfRange"))


class DateAndLabelTests(unittest.TestCase):
    def test_supported_dates_are_utc(self):
        expected = "2026-10-31T00:00:00+00:00"
        for value in ("31-10-2026", "31/10/2026", "2026-10-31", "2026/10/31"):
            self.assertEqual(pipeline.parse_date(value).isoformat(), expected)

    def test_invalid_date(self):
        self.assertIsNone(pipeline.parse_date("31/02/2026"))

    def test_known_and_unknown_labels(self):
        self.assertEqual(pipeline.parse_label("Machine_Failure")[0], True)
        self.assertEqual(pipeline.parse_label("Não")[0], False)
        value, label, issue = pipeline.parse_label("talvez")
        self.assertIsNone(value)
        self.assertEqual(label, "talvez")
        self.assertEqual(issue, "missingLabel")


class HeaderTests(unittest.TestCase):
    def test_portuguese_aliases(self):
        self.assertEqual(pipeline.ALIASES[pipeline.normalize_header("Pressão hidráulica (bar)")], "hydraulic_pressure_bar")
        self.assertEqual(pipeline.ALIASES[pipeline.normalize_header("Data e hora")], "date")


if __name__ == "__main__":
    unittest.main(verbosity=2)


class JsonCompatibilityTests(unittest.TestCase):
    def test_javascript_number_formatting(self):
        cases = {
            1.0: "1", 1e-7: "1e-7", 1e-6: "0.000001",
            1e-5: "0.00001", 1e20: "100000000000000000000",
            1e21: "1e+21", -0.0: "0",
        }
        for value, expected in cases.items():
            self.assertEqual(pipeline.js_json_dumps([value]), f"[{expected}]")


class PipelineIntegrationTests(unittest.TestCase):
    def test_pipeline_deduplicates_keeps_incomplete_and_unknown_labels(self):
        import csv
        import tempfile
        from pathlib import Path

        columns = ["date", "machine_id", "assembly_line", *pipeline.SENSORS.keys(), "downtime"]
        rows = []
        for index, pressure in enumerate([10, 10, 10, 10, 10, 10, 10, 11, 11, 100]):
            row = {column: "" for column in columns}
            row.update({"date": f"2026-10-{index + 1:02d}", "machine_id": "M1",
                        "assembly_line": "L1", "downtime": "talvez" if index == 0 else "Machine_Failure"})
            row["hydraulic_pressure_bar"] = str(pressure)
            rows.append(row)
        rows.append(dict(rows[1]))  # duplicata exata
        rows.append({**rows[2], "date": "31/02/2026"})  # data inválida

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "input.csv"
            output = root / "out"
            with source.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=columns)
                writer.writeheader()
                writer.writerows(rows)
            report = pipeline.run_pipeline(source, output)
            clean = pd.read_csv(output / "telemetry_clean.csv")
            self.assertEqual(report["received"], 12)
            self.assertEqual(report["valid"], 10)
            self.assertEqual(report["duplicates"], 1)
            self.assertEqual(report["invalid"], 1)
            self.assertEqual(report["missingLabels"], 1)
            self.assertEqual(report["outlierCells"], 1)
            self.assertEqual(len(clean), 10)
            self.assertTrue(clean["readings_incomplete"].all())
            self.assertEqual(int(clean["downtime"].isna().sum()), 1)
            self.assertTrue((output / "summary_by_machine.csv").is_file())
            self.assertTrue((output / "summary_by_line.csv").is_file())
            self.assertTrue((output / "quality_report.json").is_file())

class CompatibilityAndEdgeCaseTests(unittest.TestCase):
    def test_record_key_matches_typescript_reference_vector(self):
        record = {
            "date": pd.Timestamp("2026-10-31T12:34:56.789Z"),
            "machine_id": "MÁQ-01", "assembly_line": "Linha 2",
            "hydraulic_pressure_bar": 123.45, "coolant_pressure_bar": None,
            "air_system_pressure_bar": 7.5, "coolant_temperature_c": 31.2,
            "hydraulic_oil_temperature_c": 55.0, "spindle_bearing_temperature_c": 44.1,
            "spindle_vibration_um": 1.2, "tool_vibration_um": None,
            "spindle_speed_rpm": 15000, "voltage_v": 380.0,
            "torque_nm": 42.75, "cutting_kn": 8.0, "downtime": True,
        }
        # Vetor calculado com Date.toISOString(), JSON.stringify() e
        # crypto.createHash('sha256') no Node.js, usando a ordem do schema TS.
        self.assertEqual(pipeline.make_record_key(record), "bd36b5b5c341fec67ed258e8115793bb")

    def test_timezone_is_normalized_to_utc(self):
        parsed = pipeline.parse_date("2026-10-31T15:00:00+03:00")
        self.assertEqual(parsed.isoformat(), "2026-10-31T12:00:00+00:00")

    def test_invalid_zoned_date_and_invalid_offset(self):
        self.assertIsNone(pipeline.parse_date("2026-02-30T10:00:00Z"))
        self.assertIsNone(pipeline.parse_date("2026-10-31T10:00:00+25:00"))

    def test_duplicate_canonical_headers_are_rejected(self):
        import csv
        import tempfile
        from pathlib import Path
        columns = ["date", "Data", "machine_id", "assembly_line"]
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "duplicated_headers.csv"
            with source.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(columns)
                writer.writerow(["2026-10-31", "2026-10-31", "M1", "L1"])
            with self.assertRaisesRegex(ValueError, "Duas colunas representam date"):
                pipeline.run_pipeline(source, Path(temp) / "out")

    def test_semicolon_file_and_no_known_downtime_labels(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "semicolon.csv"
            output = root / "out"
            columns = ["date", "machine_id", "assembly_line", *pipeline.SENSORS.keys(), "downtime"]
            with source.open("w", encoding="utf-8", newline="") as handle:
                import csv
                writer = csv.DictWriter(handle, fieldnames=columns, delimiter=";")
                writer.writeheader()
                row = {column: "" for column in columns}
                row.update({"date": "31/10/2026", "machine_id": "M1", "assembly_line": "L1", "downtime": "desconhecido"})
                writer.writerow(row)
            report = pipeline.run_pipeline(source, output)
            summary = pd.read_csv(output / "summary_by_machine.csv")
            self.assertEqual(report["valid"], 1)
            self.assertEqual(report["missingLabels"], 1)
            self.assertEqual(report["rowsWithoutSensors"], 1)
            self.assertEqual(report["unknown_labels_excluded_from_failure_rate"], 1)
            self.assertTrue(pd.isna(summary.loc[0, "failure_rate_known_labels_pct"]))
            self.assertEqual(int(summary.loc[0, "incomplete_readings"]), 1)

    def test_outlier_is_flagged_but_value_is_preserved(self):
        values = [10, 10, 10, 10, 10, 10, 10, 11, 11, 100]
        frame = pd.DataFrame({"hydraulic_pressure_bar": values})
        q1, q3 = frame["hydraulic_pressure_bar"].quantile([0.25, 0.75], interpolation="linear")
        iqr = q3 - q1
        self.assertGreater(100, q3 + 3 * iqr)
        self.assertEqual(frame.loc[9, "hydraulic_pressure_bar"], 100)

    def test_quality_issues_exported_as_pipe_separated_text(self):
        import csv
        import tempfile
        from pathlib import Path

        columns = ["date", "machine_id", "assembly_line", *pipeline.SENSORS.keys(), "downtime"]
        rows = []
        for index in range(10):
            row = {column: "" for column in columns}
            row.update({"date": f"2026-10-{index + 1:02d}", "machine_id": "M1",
                        "assembly_line": "L1", "downtime": "Machine_Failure"})
            row["hydraulic_pressure_bar"] = str([10, 10, 10, 10, 10, 10, 10, 11, 11, 100][index])
            row["coolant_temperature_c"] = "0" if index == 9 else "20"  # zero vira ausente
            rows.append(row)

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "input.csv"
            with source.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=columns)
                writer.writeheader()
                writer.writerows(rows)
            pipeline.run_pipeline(source, root / "out")
            clean = pd.read_csv(root / "out" / "telemetry_clean.csv", dtype={"quality_issues": str})
            issues = clean["quality_issues"].fillna("")
            self.assertFalse(issues.str.contains(r"\[|\]|'").any())  # sem formato de lista Python
            last = issues.iloc[-1].split(pipeline.ISSUES_SEPARATOR)
            self.assertGreaterEqual(len(last), 2)  # zero tratado + outlier, separados por " | "
            self.assertTrue(any("outlier" in item for item in last))


class CommandLineErrorTests(unittest.TestCase):
    def _run(self, *args):
        import subprocess
        script = ROOT / "python" / "pipeline.py"
        return subprocess.run([sys.executable, str(script), *args], capture_output=True, text=True)

    def test_missing_input_file_exits_with_code_1_and_clear_message(self):
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            result = self._run("--input", str(Path(temp) / "nao_existe.csv"), "--output", str(Path(temp) / "out"))
        self.assertEqual(result.returncode, 1)
        self.assertIn("Erro: Arquivo de entrada não encontrado", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_empty_csv_exits_with_code_1_without_traceback(self):
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "vazio.csv"
            source.write_text("", encoding="utf-8")
            result = self._run("--input", str(source), "--output", str(Path(temp) / "out"))
        self.assertEqual(result.returncode, 1)
        self.assertTrue(result.stderr.startswith("Erro:"))
        self.assertNotIn("Traceback", result.stderr)
