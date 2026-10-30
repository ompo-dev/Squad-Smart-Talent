#!/usr/bin/env python3
"""Executa as cinco consultas SQLite, exporta CSVs e interpreta resultado real."""
import csv
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent if ROOT.name == 'scripts' else ROOT

sql_path = ROOT / '02_cinco_consultas_SQLite.sql'
if not sql_path.exists():
    sql_path = PROJECT_ROOT / 'sql' / '02_cinco_consultas_SQLite.sql'
QUERIES = sql_path.read_text(encoding='utf-8')

def rodar(db, pasta):
    pasta = Path(pasta); pasta.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db)); con.row_factory = sqlite3.Row
    dados = {}
    for i in range(1, 6):
        match = re.search(rf'-- \[CONSULTA {i}\](.*?)-- \[FIM CONSULTA {i}\]', QUERIES, re.S)
        if not match: raise RuntimeError(f'Consulta {i} não encontrada')
        lines = [line for line in match.group(1).splitlines()
                 if not line.lstrip().startswith('--')]
        query = '\n'.join(lines).strip()
        cur = con.execute(query)
        rows = cur.fetchall()
        dados[i] = [dict(r) for r in rows]
        with (pasta / f'resultado_consulta_{i}.csv').open('w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f, delimiter=';')
            writer.writerow([c[0] for c in cur.description])
            writer.writerows([tuple(r) for r in rows])
        print(f'Consulta {i}: {len(rows)} linha(s)')
    con.close()
    f = lambda v: str(v).replace('.', ',') if v is not None else 'sem dado'
    a = []
    if dados[1]:
        r=dados[1][0]
        a.append(f'1. A leitura {r["id_leitura"]}, da máquina {r["id_maquina"]}, lidera a triagem com {r["alertas_simultaneos"]} alerta(s) simultâneo(s).')
    else: a.append('1. Não foram identificadas leituras com alertas segundo os critérios configurados.')
    if dados[2]:
        r=dados[2][0]
        a.append(f'2. O turno {r["turno"]} apresenta a maior frequência de alertas de sensor, com {f(r["ocorrencias_por_100_leituras"])} ocorrência(s) a cada 100 leituras.')
    else: a.append('2. A consulta por turno não retornou leituras.')
    if dados[3]:
        r=dados[3][0]
        empatadas = [str(x['id_maquina']) for x in dados[3] if x['total_ocorrencias'] == r['total_ocorrencias']]
        a.append(f'3. Máquinas {" e ".join(empatadas)} registram o maior total de ocorrências ({r["total_ocorrencias"]} cada), incluindo leituras incompletas.' if len(empatadas)>1 else f'3. A máquina {r["id_maquina"]} registra {r["total_ocorrencias"]} ocorrências, incluindo leituras incompletas.')
    else: a.append('3. Não há máquinas na dimensão para relacionar com ocorrências.')
    if dados[4]:
        r=dados[4][0]
        a.append(f'4. A máquina {r["id_maquina"]} lidera os grupos acima da média com {f(r["ocorrencias_por_100_leituras"])} alerta(s) por 100 leituras, contra {f(r["media_frota_por_100_leituras"])} da frota.')
    else: a.append('4. Nenhuma máquina apresenta frequência de alertas acima da média da frota, ou não há dados.')
    if dados[5]:
        r=dados[5][0]
        a.append(f'5. Entre 01 e 14/05/2026, a máquina {r["id_maquina"]} é a primeira do ranking com {r["pontos_prioridade"]}/4 ponto(s), prioridade {r["prioridade"]} e tendência {r["tendencia"]}.')
    else: a.append('5. Nenhuma leitura foi encontrada no período de 01 a 14/05/2026; não é possível priorizar máquinas nesta janela.')
    report = '# Interpretação dos resultados efetivamente calculados\n\n' + '\n\n'.join(a) + '\n\n> Fonte: CSV processado na base SQLite indicada; critérios e limitações descritos no README.\n'
    (pasta / 'interpretacoes_reais.md').write_text(report, encoding='utf-8')
    print(f'Exportados 5 arquivos CSV + interpretações para: {pasta}')

if __name__ == '__main__':
    default_db = PROJECT_ROOT / 'dados' / 'grupo4_telemetria.db'
    default_out = PROJECT_ROOT / 'resultados'
    if len(sys.argv) == 1:
        if default_db.exists():
            rodar(default_db, default_out)
        else:
            raise SystemExit('Uso: python executar_consultas.py BANCO.db [pasta_resultados]')
    elif len(sys.argv) in (2, 3):
        rodar(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else default_out)
    else:
        raise SystemExit('Uso: python executar_consultas.py BANCO.db [pasta_resultados]')
