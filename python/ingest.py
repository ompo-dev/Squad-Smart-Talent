import os
import pandas as pd
import psycopg

CSV_PATH = os.getenv("CSV_PATH", "../data/telemetria_suja.csv")
DATABASE_URL = os.environ["DATABASE_URL"]

def main():
    df = pd.read_csv(CSV_PATH)
    df["temp_motor_c"] = pd.to_numeric(df["temp_motor_c"].astype(str).str.replace(",", ".", regex=False), errors="coerce")
    df["rpm"] = pd.to_numeric(df["rpm"].replace(-999, None), errors="coerce")
    df["data_hora"] = pd.to_datetime(df["data_hora"], dayfirst=True, format="mixed")
    df = df.drop_duplicates(subset=["id_leitura"])
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("""CREATE TABLE IF NOT EXISTS telemetry (id_leitura BIGINT PRIMARY KEY, id_maquina INT NOT NULL, data_hora TIMESTAMP NOT NULL, temp_motor_c NUMERIC, pressao_oleo_psi NUMERIC, rpm NUMERIC, vibracao_mm_s NUMERIC, consumo_l_h NUMERIC, horas_motor NUMERIC)""")
            for row in df.itertuples(index=False, name=None):
                cur.execute("INSERT INTO telemetry VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id_leitura) DO UPDATE SET data_hora=EXCLUDED.data_hora, temp_motor_c=EXCLUDED.temp_motor_c, rpm=EXCLUDED.rpm", row)
        conn.commit()
    print(f"Ingested {len(df)} telemetry readings")

if __name__ == "__main__": main()
