#!/usr/bin/env python3
"""Prepara dados de telemetria CSV em SQLite, sem pacotes externos.
Uso: python preparar_banco.py CAMINHO/telemetria_suja.csv [saida.db]
Cada execução cria a base de saída informada, sem sobrescrever arquivo existente.
"""
import csv
import datetime as dt
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent if ROOT.name == 'scripts' else ROOT

DDL = ROOT / '01_modelo_sqlite.sql'
if not DDL.exists():
    DDL = PROJECT_ROOT / 'sql' / '01_modelo_sqlite.sql'
CAMPOS = ('id_leitura', 'id_maquina', 'data_hora', 'temp_motor_c',
          'pressao_oleo_psi', 'rpm', 'vibracao_mm_s', 'consumo_l_h', 'horas_motor')
TEMP_ALERTA = 100.0            # hipótese de triagem do exercício, NÃO laudo da fabricante
PRESSAO_ALERTA = 20.0         # hipótese DIDÁTICA, confirmar com especialista / manual
VIBRACAO_ALERTA = 4.5        # regra de alertas usada no projeto TelemetryOS
FAIXA_INTERMEDIARIA = 1000.0  # hipótese didática
FAIXA_ALTA = 5000.0          # hipótese didática


def number(v):
    if v is None:
        return None
    s = str(v).strip().replace('\u00a0', '').replace('−', '-')
    if s.lower() in ('', 'na', 'n/a', 'nan', 'null', 'none', 'sem dado', '-', '--'):
        return None
    # Só remove unidades finais, nunca converte texto arbitrário em número.
    s = re.sub(r'\s*(?:°\s*c|c|psi|rpm|mm\s*/\s*s|l\s*/\s*h|h|horas?)\s*$', '', s, flags=re.I).strip()
    s = s.replace(' ', '')
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.') if s.rfind(',') > s.rfind('.') else s.replace(',', '')
    elif ',' in s:
        s = s.replace(',', '.')
    if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)', s):
        return None
    try:
        f = float(s)
        return f if abs(f) < 1e12 else None
    except ValueError:
        return None


def bounded(v, lo=None, hi=None):
    n = number(v)
    return n if n is not None and (lo is None or n >= lo) and (hi is None or n <= hi) else None


def timestamp(v):
    s = (v or '').strip()
    if not s:
        return None
    t = s.replace('T', ' ').removesuffix('Z')
    try:
        d = dt.datetime.fromisoformat(t)
        return d.strftime('%Y-%m-%d %H:%M:%S')
    except ValueError:
        pass
    for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y',
                '%Y-%m-%d', '%Y/%m/%d %H:%M:%S', '%Y/%m/%d %H:%M'):
        try:
            return dt.datetime.strptime(s, fmt).strftime('%Y-%m-%d %H:%M:%S')
        except ValueError:
            continue
    return None


def turno_normalizado(v, horario):
    v = (v or '').strip().upper()
    # Se o CSV já possui um turno válido, prioriza a identificação da fábrica.
    if v in ('A', 'B', 'C'):
        return v
    # Hipótese de três turnos de 8h; corrigir se a fábrica usar outra escala.
    hora = int(horario[11:13])
    return 'A' if 6 <= hora < 14 else ('B' if 14 <= hora < 22 else 'C')


def carregar(csv_path, db_path):
    csv_path, db_path = Path(csv_path), Path(db_path)
    if not csv_path.is_file():
        raise SystemExit(f'CSV não encontrado: {csv_path}')
    if db_path.exists():
        raise SystemExit(f'Banco já existe, escolha outro caminho para não sobrescrever: {db_path}')
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db_path))
    con.execute('PRAGMA foreign_keys=ON')
    try:
        with con:
            con.executescript(DDL.read_text(encoding='utf-8'))
            con.execute('''CREATE TEMP TABLE telemetria_preparada (
                id_leitura TEXT PRIMARY KEY, id_maquina TEXT, data_hora TEXT, turno TEXT,
                temp_motor_c REAL, pressao_oleo_psi REAL, rpm REAL, vibracao_mm_s REAL,
                consumo_l_h REAL, horas_motor REAL, def_superaquecimento INTEGER,
                def_pressao_baixa INTEGER, def_vibracao_alta INTEGER, perda_leitura INTEGER
            )''')
            with csv_path.open('r', encoding='utf-8-sig', newline='') as f:
                sample = f.read(8192); f.seek(0)
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
                    delimiter = dialect.delimiter
                except csv.Error:
                    delimiter = ';' if sample.count(';') > sample.count(',') else ','
                reader = csv.DictReader(f, delimiter=delimiter)
                reader.fieldnames = [(x or '').strip() for x in (reader.fieldnames or [])]
                missing = set(CAMPOS) - set(reader.fieldnames)
                if missing:
                    raise ValueError('Colunas faltando no CSV: ' + ', '.join(sorted(missing)))
                total = rejeitadas = 0
                for linha, row in enumerate(reader, start=2):
                    if not row or all(v is None or not str(v).strip() for v in row.values()):
                        continue
                    total += 1
                    raw = [(row.get(k) or '').strip() for k in CAMPOS]
                    ident, maquina, dh = raw[:3]
                    iso = timestamp(dh)
                    motivos = []
                    if not ident:
                        motivos.append('id_leitura ausente')
                    if not maquina:
                        motivos.append('id_maquina ausente')
                    if not iso:
                        motivos.append('data_hora inválida')
                    if ident and con.execute('SELECT 1 FROM telemetria_preparada WHERE id_leitura=?', (ident,)).fetchone():
                        motivos.append('id_leitura duplicado (primeira linha preservada)')
                    con.execute('''INSERT INTO telemetria_suja
                      (id_leitura,id_maquina,data_hora,temp_motor_c,pressao_oleo_psi,rpm,
                       vibracao_mm_s,consumo_l_h,horas_motor,turno)
                      VALUES (?,?,?,?,?,?,?,?,?,?)''', tuple(raw) + ((row.get('turno') or ''),))
                    if motivos:
                        rejeitadas += 1
                        con.execute('INSERT INTO rejeicoes_importacao(linha_csv,id_leitura,motivo) VALUES(?,?,?)',
                                    (linha, ident, '; '.join(motivos)))
                        continue
                    temp = bounded(row.get('temp_motor_c'), -40, 200)
                    pressao = bounded(row.get('pressao_oleo_psi'), 0, 300)
                    rpm = bounded(row.get('rpm'), 0, 10000)
                    vib = bounded(row.get('vibracao_mm_s'), 0, 100)
                    consumo = bounded(row.get('consumo_l_h'), 0, 1000000)
                    horas = bounded(row.get('horas_motor'), 0, 100000000)
                    incompleta = int(any(x is None for x in (temp, pressao, rpm, vib)))
                    con.execute('''INSERT INTO telemetria_preparada VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                                (ident, maquina, iso, turno_normalizado(row.get('turno'), iso),
                                 temp, pressao, rpm, vib, consumo, horas,
                                 int(temp is not None and temp >= TEMP_ALERTA),
                                 int(pressao is not None and pressao < PRESSAO_ALERTA),
                                 int(vib is not None and vib > VIBRACAO_ALERTA), incompleta))

            # Desafio do enunciado: dimensão inicialmente construída por DISTINCT.
            con.execute('CREATE TEMP TABLE maquinas_distintas AS SELECT DISTINCT id_maquina FROM telemetria_preparada')
            con.execute('''INSERT INTO dim_maquina(id_maquina,faixa_uso,horas_motor_atual,consumo_medio_l_h)
                SELECT d.id_maquina,
                       CASE WHEN MAX(p.horas_motor) IS NULL THEN 'Sem classificação'
                            WHEN MAX(p.horas_motor) < ? THEN 'Baixa'
                            WHEN MAX(p.horas_motor) < ? THEN 'Média'
                            ELSE 'Alta' END,
                       MAX(p.horas_motor), AVG(p.consumo_l_h)
                FROM maquinas_distintas d JOIN telemetria_preparada p
                     ON p.id_maquina=d.id_maquina GROUP BY d.id_maquina''',
                        (FAIXA_INTERMEDIARIA, FAIXA_ALTA))
            con.execute('''INSERT INTO telemetria_limpa
                (id_leitura,id_maquina,data_hora,turno,temp_motor_c,pressao_oleo_psi,rpm,
                 vibracao_mm_s,consumo_l_h,horas_motor,def_superaquecimento,
                 def_pressao_baixa,def_vibracao_alta,perda_leitura)
                SELECT id_leitura,id_maquina,data_hora,turno,temp_motor_c,pressao_oleo_psi,
                       rpm,vibracao_mm_s,consumo_l_h,horas_motor,def_superaquecimento,
                       def_pressao_baixa,def_vibracao_alta,perda_leitura
                FROM telemetria_preparada''')
            con.execute('''INSERT INTO fato_ocorrencia(id_leitura,id_maquina,tipo_ocorrencia)
                SELECT id_leitura,id_maquina,'Superaquecimento' FROM telemetria_limpa WHERE def_superaquecimento=1
                UNION ALL SELECT id_leitura,id_maquina,'Pressão baixa' FROM telemetria_limpa WHERE def_pressao_baixa=1
                UNION ALL SELECT id_leitura,id_maquina,'Vibração alta' FROM telemetria_limpa WHERE def_vibracao_alta=1
                UNION ALL SELECT id_leitura,id_maquina,'Perda de leitura' FROM telemetria_limpa WHERE perda_leitura=1''')
            problemas = con.execute('PRAGMA foreign_key_check').fetchall()
            if problemas:
                raise AssertionError(f'Inconsistência de chaves estrangeiras: {problemas[:3]}')
            print(f'CSV: {csv_path.name} | brutas: {total} | rejeitadas: {rejeitadas}')
            for table in ('telemetria_limpa','dim_maquina','fato_ocorrencia'):
                print(f'  {table}: {con.execute("SELECT COUNT(*) FROM " + table).fetchone()[0]} registros')
            print(f'Banco SQLite criado: {db_path}')
    except Exception:
        con.close()
        if db_path.exists(): db_path.unlink()
        raise
    finally:
        try: con.close()
        except Exception: pass


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        raise SystemExit('Uso: python preparar_banco.py dados.csv [banco_saida.db]')
    carregar(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else 'grupo4_oee.db')
