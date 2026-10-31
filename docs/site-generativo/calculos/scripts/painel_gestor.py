#!/usr/bin/env python3
"""Painel do Gestor: pipeline que recebe lotes de dados das máquinas e mantém o painel atualizado.

Fluxo (um comando por etapa, todos idempotentes):
  1. lote <arquivo.csv>  recebe um lote, guarda no histórico (sem duplicar) e recalcula o painel
  2. recalcular          refaz custo, disponibilidade, risco e plano 5W2H com todo o histórico
  3. treinar             reaprende o modelo de risco (o comando lote já faz isso a cada 7 dias de dados novos)
  4. painel.json         é o arquivo que a tela "Gestão" do app e a IA leem (contrato no README)
  5. semanal             mostra a mensagem de WhatsApp da semana e o link para enviar

Outros comandos:
  completo   apaga o estado e processa o dataset inteiro de uma vez (gera os resultados versionados)
  simular    divide o dataset em lotes semanais, processa um por um e confere o resultado (teste)

Qualquer máquina ou dataset: basta um arquivo em config/ dizendo qual coluna é qual (--config).
"""
import argparse
import csv
import hashlib
import json
import shutil
import sqlite3
import sys
import tempfile
import urllib.parse
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np

PASTA = Path(__file__).resolve().parent.parent
CONFIG_PADRAO = PASTA / 'config' / 'machine_downtime.json'
DATASET_PADRAO = PASTA / 'dados' / 'machine_downtime.csv'
DIAS_PARA_REAPRENDER = 7
MINIMO_PARA_TREINAR = 100      # registros; e pelo menos 10 de cada classe (falhou / não falhou)
REGISTROS_RECENTES = 30        # janela usada para a "chance de falha hoje" de cada máquina
# O que a fábrica precisa começar a medir para ter o OEE completo e ligar o painel à manutenção
PLANO_COLETA = [
    dict(pilar='Disponibilidade', falta='Início e fim de cada parada e horas planejadas por turno', como='Apontamento no painel da máquina ou no MES'),
    dict(pilar='Desempenho', falta='Tempo de ciclo ideal e peças produzidas por hora', como='Contador de peças do CNC'),
    dict(pilar='Qualidade', falta='Peças boas e peças refugadas', como='Registro da inspeção de qualidade'),
    dict(pilar='Causa da parada', falta='Área real de cada parada: elétrica, mecânica, automação ou operacional', como='Ordem de manutenção no SAP'),
    dict(pilar='Preventivas', falta='Preventivas planejadas e realizadas', como='Ordens de manutenção do SAP (via API)'),
]


# ---------------------------------------------------------------- formatação brasileira

def num(v, casas=1):
    return f'{v:,.{casas}f}'.replace(',', '_').replace('.', ',').replace('_', '.')


def reais(v):
    return 'R$ ' + num(v, 0)


def pct(v):
    return num(v * 100) + '%'


def br(d):
    return date.fromisoformat(d).strftime('%d/%m/%Y')


# ---------------------------------------------------------------- 1. receber lotes

def abrir(estado):
    estado.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(estado / 'historico.db')
    db.executescript('''
        CREATE TABLE IF NOT EXISTS registros (
            chave TEXT PRIMARY KEY, maquina TEXT NOT NULL, data TEXT NOT NULL,
            falha INTEGER NOT NULL, sensores TEXT NOT NULL, lote INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS lotes (
            id INTEGER PRIMARY KEY, arquivo TEXT, recebido_em TEXT, linhas INTEGER,
            novas INTEGER, duplicadas INTEGER, invalidas INTEGER, exemplos_erro TEXT);''')
    return db


def ler_lote(arquivo, cfg):
    """Lê um CSV usando o 'tradutor' de colunas do config. Devolve linhas válidas e erros."""
    sep = cfg['arquivo'].get('separador', ',')
    validas, erros = [], []
    with open(arquivo, encoding=cfg['arquivo'].get('encoding', 'utf-8'), newline='') as f:
        for n, linha in enumerate(csv.DictReader(f, delimiter=sep), start=2):
            try:
                maquina = linha[cfg['coluna_maquina']].strip()
                if not maquina:
                    raise ValueError('máquina vazia')
                data = datetime.strptime(linha[cfg['coluna_data']].strip(), cfg['formato_data']).date().isoformat()
                falha = int(linha[cfg['coluna_falha']].strip() == cfg['valor_falha'])
                sensores = []
                for c in cfg['sensores']:
                    v = (linha.get(c) or '').strip().replace(',', '.') if sep != ',' else (linha.get(c) or '').strip()
                    sensores.append(float(v) if v else None)  # vazio fica ausente; o modelo preenche com a mediana
            except (KeyError, ValueError) as e:
                erros.append(f'linha {n}: {e}')
                continue
            validas.append((maquina, data, falha, sensores))
    return validas, erros


def receber_lote(db, arquivo, cfg):
    validas, erros = ler_lote(arquivo, cfg)
    if not validas:
        raise SystemExit(f'Lote recusado: nenhuma linha válida em {arquivo}. Exemplos: {erros[:5]}')
    lote = db.execute('INSERT INTO lotes (arquivo, recebido_em, linhas) VALUES (?, ?, ?)',
                      (Path(arquivo).name, datetime.now(timezone.utc).isoformat(timespec='seconds'),
                       len(validas) + len(erros))).lastrowid
    novas = 0
    for maquina, data, falha, sensores in validas:
        # a mesma leitura reenviada gera a mesma chave e não entra de novo (idempotência)
        chave = hashlib.sha1(json.dumps([maquina, data, falha, sensores]).encode()).hexdigest()
        cur = db.execute('INSERT OR IGNORE INTO registros VALUES (?, ?, ?, ?, ?, ?)',
                         (chave, maquina, data, falha, json.dumps(sensores), lote))
        novas += cur.rowcount
    db.execute('UPDATE lotes SET novas=?, duplicadas=?, invalidas=?, exemplos_erro=? WHERE id=?',
               (novas, len(validas) - novas, len(erros), json.dumps(erros[:5], ensure_ascii=False), lote))
    db.commit()
    print(f'Lote {lote} ({Path(arquivo).name}): {novas} novas, {len(validas) - novas} duplicadas, {len(erros)} inválidas')


def carregar(db):
    linhas = db.execute('SELECT maquina, data, falha, sensores FROM registros ORDER BY data, rowid').fetchall()
    maquinas = np.array([l[0] for l in linhas])
    datas = np.array([l[1] for l in linhas])
    falha = np.array([bool(l[2]) for l in linhas])
    x = np.array([[np.nan if v is None else v for v in json.loads(l[3])] for l in linhas], dtype=float)
    return maquinas, datas, falha, x


# ---------------------------------------------------------------- 3. modelo de risco

def _ajustar(x, y, passos=3000, taxa=0.1):
    """Regressão logística: aprende a chance de falha a partir dos sensores padronizados."""
    p = np.zeros(x.shape[1]); b = 0.0
    for _ in range(passos):
        z = 1 / (1 + np.exp(-(x @ p + b)))
        p -= taxa * (x.T @ (z - y) / len(y) + 0.01 * p)
        b -= taxa * np.mean(z - y)
    return p, b


def _preparar(x, mediana, media, desvio):
    return (np.where(np.isnan(x), mediana, x) - media) / desvio


def chance(modelo, x):
    xn = _preparar(x, *(np.array(modelo[k]) for k in ('mediana', 'media', 'desvio')))
    return 1 / (1 + np.exp(-(xn @ np.array(modelo['pesos']) + modelo['vies'])))


def _treinar(x, y):
    mediana = np.nanmedian(x, axis=0)
    xc = np.where(np.isnan(x), mediana, x)
    media, desvio = xc.mean(axis=0), xc.std(axis=0)
    desvio[desvio == 0] = 1  # sensor constante não pode dividir por zero
    p, b = _ajustar(_preparar(x, mediana, media, desvio), y.astype(float))
    return dict(mediana=mediana.tolist(), media=media.tolist(), desvio=desvio.tolist(), pesos=p.tolist(), vies=float(b))


def validacao_recente(validacoes, minimo=100):
    """Junta os testes mais recentes até somar pelo menos 100 registros: uma semana com 3 registros sozinha não diz nada."""
    regs = acertos = chutes = 0
    for v in reversed(validacoes):
        regs += v['registros']; acertos += v['acerto'] * v['registros']; chutes += v['chute'] * v['registros']
        if regs >= minimo:
            break
    return dict(registros=regs, acerto=acertos / regs, chute=chutes / regs,
                tipo=validacoes[-1]['tipo'] if len(validacoes) == 1 else 'semanas seguintes, somadas')


def _media(v):
    v = v[~np.isnan(v)]
    return round(float(v.mean()), 2) if len(v) else None


def _acerto(modelo, x, y):
    return float(np.mean((chance(modelo, x) >= 0.5) == y)), float(max(y.mean(), 1 - y.mean()))


def treinar(db, estado, forcar=False):
    """Reaprende quando há 7 dias de dados novos (ou se forçado). Antes, mede o modelo antigo nos dados novos."""
    maquinas, datas, falha, x = carregar(db)
    arq = estado / 'modelo.json'
    antigo = json.loads(arq.read_text(encoding='utf-8')) if arq.exists() else None
    if len(falha) < MINIMO_PARA_TREINAR or min(falha.sum(), (~falha).sum()) < 10:
        print('Ainda não há dados suficientes para treinar o modelo de risco.')
        return antigo
    ultima = date.fromisoformat(datas[-1])
    if antigo and not forcar and ultima < date.fromisoformat(antigo['dados_ate']) + timedelta(days=DIAS_PARA_REAPRENDER):
        return antigo

    historico = antigo['validacoes'] if antigo else []
    if antigo:
        # validação "para frente": o modelo antigo nunca viu estes dias, como acontece na vida real
        novos = datas > antigo['dados_ate']
        if novos.sum():
            a, c = _acerto(antigo, x[novos], falha[novos])
            historico.append(dict(tipo='semana seguinte', ate=datas[-1], registros=int(novos.sum()), acerto=a, chute=c))
    else:
        # primeiro treino: aprende com os 70% mais antigos e testa nos 30% mais recentes
        corte = int(0.7 * len(falha))
        provisorio = _treinar(x[:corte], falha[:corte])
        a, c = _acerto(provisorio, x[corte:], falha[corte:])
        historico.append(dict(tipo='30% mais recentes', ate=datas[-1], registros=len(falha) - corte, acerto=a, chute=c))

    modelo = _treinar(x, falha)
    modelo.update(dados_ate=datas[-1], treinado_em=datetime.now(timezone.utc).isoformat(timespec='seconds'),
                  registros=len(falha), validacoes=historico)
    arq.write_text(json.dumps(modelo, ensure_ascii=False, indent=1), encoding='utf-8')
    v = historico[-1]
    print(f'Modelo reaprendido com {len(falha)} registros (dados até {br(datas[-1])}). '
          f'Acerto em dados novos: {pct(v["acerto"])} (chute: {pct(v["chute"])}).')
    return modelo


# ---------------------------------------------------------------- 2. recalcular o painel

def recalcular(db, estado, cfg, saida):
    saida.mkdir(parents=True, exist_ok=True)
    maquinas, datas, falha, x = carregar(db)
    if not len(falha):
        raise SystemExit('Histórico vazio: envie um lote primeiro.')
    pr = {k: v['valor'] for k, v in cfg['premissas'].items()}
    custo_falha = pr['horas_por_falha'] * pr['custo_hora']
    inicio, fim = date.fromisoformat(datas[0]), date.fromisoformat(datas[-1])
    meses = ((fim - inicio).days + 1) / 30.44
    semana = datas > (fim - timedelta(days=7)).isoformat()
    arq_modelo = estado / 'modelo.json'
    modelo = json.loads(arq_modelo.read_text(encoding='utf-8')) if arq_modelo.exists() else None
    validacao = validacao_recente(modelo['validacoes']) if modelo else None
    confiavel = bool(validacao and validacao['acerto'] > validacao['chute'])
    prob = chance(modelo, x) if modelo else None
    colunas = list(cfg['sensores'])

    meta = pr.get('meta_disponibilidade', 0.9)
    limite_sem_dados = pr.get('dias_sem_dados_alerta', 7)
    lista = []
    for m in sorted(set(maquinas)):
        sel = np.flatnonzero(maquinas == m)
        falhas = int(falha[sel].sum())
        dias = len(set(datas[sel]))
        horas = falhas * pr['horas_por_falha']
        disp = 1 - horas / (dias * pr['horas_dia'])
        sem_dados = (fim - date.fromisoformat(datas[sel[-1]])).days
        item = dict(maquina=m, registros=len(sel), falhas=falhas, dias_com_registro=dias, horas_paradas=round(horas, 1),
                    custo=round(horas * pr['custo_hora'], 2), disponibilidade=round(disp, 4), abaixo_da_meta=disp < meta,
                    mtbf_h=round(dias * pr['horas_dia'] / falhas, 1) if falhas else None,
                    falhas_semana=int(falha[sel][semana[sel]].sum()), ultima_leitura=datas[sel[-1]],
                    dias_sem_dados=sem_dados, sem_dados=sem_dados > limite_sem_dados,
                    chance_falha_hoje=None, risco_dia=None, saude=None, falhas_esperadas_dia=None, proxima_falha_h=None)
        if modelo:
            c = float(prob[sel[-REGISTROS_RECENTES:]].mean())
            por_dia = c * len(sel) / dias
            # saúde 0-100: o inverso da chance de falha recente (100 = nenhuma chance de falhar)
            item.update(chance_falha_hoje=round(c, 4), risco_dia=round(por_dia * custo_falha, 2), saude=round(100 * (1 - c)),
                        falhas_esperadas_dia=round(por_dia, 2), proxima_falha_h=round(24 / por_dia, 1) if por_dia else None)
        lista.append(item)
    lista.sort(key=lambda r: -(r['risco_dia'] or 0))
    for i, r in enumerate(lista, start=1):
        r['posicao'] = i

    sensores = []
    for i, c in enumerate(colunas):
        sensores.append(dict(coluna=c, nome=cfg['sensores'][c]['nome'],
                             media_nas_falhas=_media(x[falha, i]), media_normal=_media(x[~falha, i]),
                             peso=round(modelo['pesos'][i], 3) if modelo else None))
    sensores.sort(key=lambda s: -abs(s['peso'] or 0))

    # Área de cada falha: a do sensor que mais empurrou a chance de falha naquele registro
    areas = []
    if modelo:
        empurrao = _preparar(x, *(np.array(modelo[k]) for k in ('mediana', 'media', 'desvio'))) * np.array(modelo['pesos'])
        area_do_sensor = np.array([cfg['sensores'][c].get('area', 'Outros') for c in colunas])
        area_falha = area_do_sensor[empurrao[falha].argmax(axis=1)]
        maq_falha = maquinas[falha]
        for a in sorted(set(area_do_sensor)):
            n = int((area_falha == a).sum())
            areas.append(dict(area=a, falhas=n, custo=round(n * custo_falha, 2), parte=round(n / max(int(falha.sum()), 1), 4),
                              por_maquina={m: int(((area_falha == a) & (maq_falha == m)).sum()) for m in sorted(set(maquinas))}))
        areas.sort(key=lambda a: -a['falhas'])

    # Mês a mês e tendência: compara os dois últimos meses com pelo menos 50 registros
    mensal = []
    for mes in sorted(set(d[:7] for d in datas)):
        s = np.array([d.startswith(mes) for d in datas])
        dias_m = sum(len(set(datas[s & (maquinas == m)])) for m in set(maquinas[s]))
        horas_m = float(falha[s].sum()) * pr['horas_por_falha']
        mensal.append(dict(mes=mes, registros=int(s.sum()), falhas=int(falha[s].sum()), taxa_falha=round(float(falha[s].mean()), 4),
                           custo=round(horas_m * pr['custo_hora'], 2), disponibilidade=round(1 - horas_m / (dias_m * pr['horas_dia']), 4),
                           por_maquina={m: int(falha[s & (maquinas == m)].sum()) for m in sorted(set(maquinas))}))
    cheios = [m for m in mensal if m['registros'] >= 50]
    tendencia = None
    if len(cheios) >= 2:
        a, b = cheios[-2], cheios[-1]
        tendencia = dict(de=a['mes'], para=b['mes'], taxa_antes=a['taxa_falha'], taxa_depois=b['taxa_falha'],
                         disponibilidade_antes=a['disponibilidade'], disponibilidade_depois=b['disponibilidade'],
                         melhorou=b['taxa_falha'] < a['taxa_falha'])

    custo_total = sum(r['custo'] for r in lista)
    custo_mes = custo_total / meses
    economia = custo_mes * pr['reducao_preditiva']
    plano = []
    arq_acoes = estado / 'acoes.json'
    status = json.loads(arq_acoes.read_text(encoding='utf-8')) if arq_acoes.exists() else {}
    if modelo:
        com_media = [s for s in sensores if s['media_nas_falhas'] is not None and s['media_normal'] is not None]
        for semana_n, s in enumerate(com_media[:3], start=1):
            info = cfg['sensores'][s['coluna']]
            alto = s['media_nas_falhas'] > s['media_normal']
            st = status.get(s['coluna'], {})
            prazo = (fim + timedelta(days=7 * semana_n)).isoformat()
            feita = st.get('status') == 'feita'
            plano.append(dict(
                id=s['coluna'], area=info.get('area', 'Outros'), prazo=prazo, status=st.get('status', 'a fazer'),
                concluida_em=st.get('em'),
                no_prazo=(st['em'] <= prazo) if feita else fim.isoformat() <= prazo,
                o_que=info.get('acao', f'Inspecionar o componente ligado a: {s["nome"]}'),
                por_que=f'Nas falhas, o valor de {s["nome"]} fica mais {"alto" if alto else "baixo"}: média '
                        f'{num(s["media_nas_falhas"])} contra {num(s["media_normal"])} no funcionamento normal',
                onde=f'Todas as máquinas, começando pela {lista[0]["maquina"]} (maior risco em R$)',
                quando=f'Semana {semana_n} (até {br(prazo)})',
                quem=info.get('responsavel', 'Técnico de manutenção'),
                como=f'Inspeção semanal e alerta quando o sensor ficar {"acima" if alto else "abaixo"} de '
                     f'{num((s["media_nas_falhas"] + s["media_normal"]) / 2)}',
                quanto=f'Até {reais(economia / 3)} por mês se paga com a economia prevista'))

    lotes = [dict(zip(['lote', 'arquivo', 'recebido_em', 'linhas', 'novas', 'duplicadas', 'invalidas'], l))
             for l in db.execute('SELECT id, arquivo, recebido_em, linhas, novas, duplicadas, invalidas FROM lotes ORDER BY id')]
    acoes = dict(total=len(plano), feitas=sum(a['status'] == 'feita' for a in plano),
                 no_prazo=sum(a['no_prazo'] for a in plano), atrasadas=sum(not a['no_prazo'] for a in plano))
    alertas = [f'{r["maquina"]} sem enviar dados há {r["dias_sem_dados"]} dias (última leitura {br(r["ultima_leitura"])})'
               for r in lista if r['sem_dados']]
    alertas += [f'{r["maquina"]} abaixo da meta de disponibilidade ({pct(r["disponibilidade"])} contra {pct(meta)})'
                for r in lista if r['abaixo_da_meta']]
    painel = dict(
        versao=2, dataset=cfg['nome'], gerado_em=datetime.now(timezone.utc).isoformat(timespec='seconds'),
        periodo=dict(inicio=datas[0], fim=datas[-1], meses=round(meses, 2)),
        premissas=cfg['premissas'],
        frota=dict(registros=len(falha), falhas=int(falha.sum()), horas_paradas=round(float(falha.sum()) * pr['horas_por_falha'], 1),
                   custo_total=round(custo_total, 2), custo_mes=round(custo_mes, 2), economia_preditiva_mes=round(economia, 2),
                   falhas_semana=int(falha[semana].sum()),
                   custo_semana=round(float(falha[semana].sum()) * custo_falha, 2)),
        maquinas=lista, alertas=alertas, areas=areas, areas_fonte=cfg.get('areas_fonte'), mensal=mensal, tendencia=tendencia,
        sensores=sensores, plano_5w2h=plano, acoes=acoes, plano_coleta=PLANO_COLETA,
        modelo=None if not modelo else dict(dados_ate=modelo['dados_ate'], treinado_em=modelo['treinado_em'],
                                            registros=modelo['registros'], confiavel=confiavel, validacao=validacao,
                                            validacoes=modelo['validacoes']),
        lotes=lotes)
    conferir(painel)
    (saida / 'painel.json').write_text(json.dumps(painel, ensure_ascii=False, indent=1), encoding='utf-8')
    escrever_relatorios(painel, saida)
    return painel


def conferir(p):
    """Conferências que valem para qualquer dataset: se uma falhar, o painel não é gravado."""
    assert sum(m['falhas'] for m in p['maquinas']) == p['frota']['falhas'], 'soma das falhas não fecha'
    assert sum(m['registros'] for m in p['maquinas']) == p['frota']['registros'], 'soma dos registros não fecha'
    assert all(0 <= m['disponibilidade'] <= 1 for m in p['maquinas']), 'disponibilidade fora de 0 a 100%'
    assert all(m['chance_falha_hoje'] is None or 0 <= m['chance_falha_hoje'] <= 1 for m in p['maquinas'])
    assert abs(sum(m['custo'] for m in p['maquinas']) - p['frota']['custo_total']) < 0.05
    assert not p['areas'] or sum(a['falhas'] for a in p['areas']) == p['frota']['falhas'], 'soma das áreas não fecha'
    assert sum(m['falhas'] for m in p['mensal']) == p['frota']['falhas'], 'soma dos meses não fecha'
    assert all(m['saude'] is None or 0 <= m['saude'] <= 100 for m in p['maquinas'])


# ---------------------------------------------------------------- 4. arquivos para pessoas (e 5. WhatsApp)

def svg_barras(titulo, rotulos, valores, formato, arquivo, nota=''):
    """Gráfico de barras horizontais em SVG puro (abre no navegador e no GitHub)."""
    larg, alt_barra, esq = 760, 34, 290
    alt = 70 + alt_barra * len(rotulos) + (24 if nota else 0)
    maior = max([abs(v) for v in valores] + [1e-9])
    partes = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{larg}" height="{alt}" font-family="Arial" font-size="14">',
              f'<rect width="100%" height="100%" fill="white"/><text x="16" y="30" font-size="18" font-weight="bold">{titulo}</text>']
    for i, (r, v) in enumerate(zip(rotulos, valores)):
        y = 52 + i * alt_barra
        w = abs(v) / maior * (larg - esq - 130)
        c = '#2f6f4f' if v >= 0 else '#b5523b'
        partes.append(f'<text x="{esq - 10}" y="{y + 20}" text-anchor="end">{r}</text>'
                      f'<rect x="{esq}" y="{y + 4}" width="{w:.1f}" height="{alt_barra - 10}" fill="{c}" rx="3"/>'
                      f'<text x="{esq + w + 8:.1f}" y="{y + 20}">{formato(v)}</text>')
    if nota:
        partes.append(f'<text x="16" y="{alt - 14}" fill="#555">{nota}</text>')
    partes.append('</svg>')
    arquivo.write_text('\n'.join(partes), encoding='utf-8')


def gravar_csv(arquivo, cabecalho, linhas):
    with arquivo.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(cabecalho); w.writerows(linhas)


def mensagem_whatsapp(p):
    f, top = p['frota'], p['maquinas'][0]
    linhas = [f'*Painel do Gestor · semana até {br(p["periodo"]["fim"])}*',
              f'Falhas na semana: {f["falhas_semana"]} · custo estimado: {reais(f["custo_semana"])}']
    linhas += [f'Atenção: {a}' for a in p['alertas'] if 'sem enviar dados' in a]
    if p['areas']:
        linhas.append(f'Área que mais gera falhas: {p["areas"][0]["area"]} ({pct(p["areas"][0]["parte"])})')
    if p['modelo'] and p['modelo']['confiavel']:
        linhas.append(f'Máquina em maior risco: {top["maquina"]} ({pct(top["chance_falha_hoje"])} de chance, {reais(top["risco_dia"])} por dia)')
    if p['plano_5w2h']:
        linhas.append(f'Ação da semana: {p["plano_5w2h"][0]["o_que"]} ({p["plano_5w2h"][0]["quem"]})')
    linhas.append(f'Com manutenção preditiva, a economia estimada é de {reais(f["economia_preditiva_mes"])} por mês.')
    return '\n'.join(linhas)


def escrever_relatorios(p, saida):
    m, s, f = p['maquinas'], p['sensores'], p['frota']
    gravar_csv(saida / 'indicadores_por_maquina.csv',
               ['maquina', 'registros', 'falhas', 'dias_com_registro', 'horas_paradas', 'custo_parada_rs', 'disponibilidade'],
               [[r['maquina'], r['registros'], r['falhas'], r['dias_com_registro'], r['horas_paradas'], r['custo'], r['disponibilidade']]
                for r in sorted(m, key=lambda r: r['maquina'])])
    gravar_csv(saida / 'risco_por_maquina.csv', ['posicao', 'maquina', 'chance_de_falha_hoje', 'risco_rs_por_dia'],
               [[r['posicao'], r['maquina'], r['chance_falha_hoje'], r['risco_dia']] for r in m])
    gravar_csv(saida / 'sensores.csv', ['sensor', 'media_nas_falhas', 'media_normal', 'peso_no_modelo'],
               [[x['nome'], x['media_nas_falhas'], x['media_normal'], x['peso']] for x in s])

    titulos = ['O quê', 'Por quê', 'Onde', 'Quando', 'Quem', 'Como', 'Quanto custa', 'Área', 'Status']
    campos = ['o_que', 'por_que', 'onde', 'quando', 'quem', 'como', 'quanto', 'area', 'status']
    md = ['# Plano de ação 5W2H', '', '| ' + ' | '.join(titulos) + ' |', '|' + '---|' * len(titulos)]
    md += ['| ' + ' | '.join(str(a[c]) for c in campos) + ' |' for a in p['plano_5w2h']]
    md += ['', f'{p["acoes"]["feitas"]} de {p["acoes"]["total"]} ações feitas · {p["acoes"]["no_prazo"]} no prazo · '
                f'{p["acoes"]["atrasadas"]} atrasadas. Para marcar uma ação: `python scripts/painel_gestor.py acao <n> --status feita`.']
    (saida / 'plano_5w2h.md').write_text('\n'.join(md) + '\n', encoding='utf-8')

    por_nome = sorted(m, key=lambda r: r['maquina'])
    svg_barras('Custo estimado das paradas no período', [r['maquina'] for r in por_nome], [r['custo'] for r in por_nome],
               reais, saida / 'custo_por_maquina.svg')
    if p['modelo']:
        svg_barras('Peso de cada sensor na chance de falha', [x['nome'] for x in s], [x['peso'] for x in s],
                   lambda v: f'{v:+.2f}'.replace('.', ','), saida / 'sensores_falha.svg',
                   nota='Verde: valor alto aumenta a chance de falha. Vermelho: valor baixo aumenta a chance de falha.')

    pr = {k: v['valor'] for k, v in p['premissas'].items()}
    resumo = ['# Resumo do Painel do Gestor', '',
              f'Dataset: {p["dataset"]}. Período: {br(p["periodo"]["inicio"])} a {br(p["periodo"]["fim"])} '
              f'({num(p["periodo"]["meses"])} meses), {f["registros"]} registros, {len(m)} máquinas, {len(p["lotes"])} lote(s) recebido(s).', '',
              '## 1. Custo das paradas',
              f'- {f["falhas"]} falhas x {num(pr["horas_por_falha"], 2)} h x R$ {num(pr["custo_hora"], 2)}/h = '
              f'**{reais(f["custo_total"])}** no período (**{reais(f["custo_mes"])} por mês**).',
              f'- Última semana: {f["falhas_semana"]} falhas, {reais(f["custo_semana"])}.', '',
              '## Alertas', *([f'- {a}' for a in p['alertas']] or ['- Nenhum']), '',
              '## 2. Disponibilidade (pilar do OEE que o dataset permite medir)',
              *[f'- {r["maquina"]}: {pct(r["disponibilidade"])} · tempo médio entre falhas {num(r["mtbf_h"])} h'
                for r in por_nome if r['mtbf_h']],
              *([f'- Tendência ({p["tendencia"]["de"]} → {p["tendencia"]["para"]}): taxa de falha '
                 f'{pct(p["tendencia"]["taxa_antes"])} → {pct(p["tendencia"]["taxa_depois"])} '
                 f'({"melhorou" if p["tendencia"]["melhorou"] else "piorou"})'] if p['tendencia'] else []),
              '- Desempenho e qualidade: **não medidos** (faltam produção prevista, produção real e peças boas). Ver o plano de coleta no README.', '',
              '## 3. Risco em R$ (chance de falha x custo da falha)']
    if p['modelo']:
        v = p['modelo']['validacao']
        resumo.append(f'- Modelo treinado com {p["modelo"]["registros"]} registros (dados até {br(p["modelo"]["dados_ate"])}). '
                      f'Último teste ({v["tipo"]}, {v["registros"]} registros que ele não tinha visto): acerto de {pct(v["acerto"])}; '
                      f'chutar sempre a mesma resposta acertaria {pct(v["chute"])}.')
        if not p['modelo']['confiavel']:
            resumo.append('- **Atenção: o modelo não superou o chute no último teste. Não use o ranking de risco.**')
        resumo += [f'- {r["posicao"]}º {r["maquina"]}: chance de falha hoje {pct(r["chance_falha_hoje"])}, risco de **{reais(r["risco_dia"])} por dia**' for r in m]
        resumo.append(f'- Sensores que mais pesam: {", ".join(x["nome"] for x in s[:3])}.')
    else:
        resumo.append('- Ainda não há dados suficientes para o modelo de risco.')
    if p['areas']:
        resumo += ['', '## Falhas por área (premissa: área do sensor que mais pesou em cada falha)',
                   *[f'- {a["area"]}: {a["falhas"]} falhas ({pct(a["parte"])}), {reais(a["custo"])}' for a in p['areas']]]
    resumo += ['', '## 4. Preditiva x corretiva',
               f'- Esperar quebrar: {reais(f["custo_mes"])} por mês. Com preditiva (-{pr["reducao_preditiva"]:.0%} de paradas): '
               f'economia de **{reais(f["economia_preditiva_mes"])} por mês**.',
               f'- Um programa de preditiva que custe até {reais(f["economia_preditiva_mes"])} por mês já se paga.', '',
               '## 5. Plano de ação', '- Ver [plano_5w2h.md](plano_5w2h.md).', '',
               '## Mensagem da semana (WhatsApp)', '', '```', mensagem_whatsapp(p), '```']
    (saida / 'resumo.md').write_text('\n'.join(resumo) + '\n', encoding='utf-8')
    (saida / 'mensagem_whatsapp.txt').write_text(mensagem_whatsapp(p) + '\n', encoding='utf-8')


# ---------------------------------------------------------------- comandos

def simular(cfg, dataset):
    """Teste de ponta a ponta: o dataset chega em lotes semanais, como chegaria do app."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        with open(dataset, encoding=cfg['arquivo']['encoding'], newline='') as f:
            leitor = csv.DictReader(f)
            cabecalho, linhas = leitor.fieldnames, list(leitor)
        semana = lambda l: datetime.strptime(l[cfg['coluna_data']], cfg['formato_data']).date().isocalendar()[:2]
        grupos = {}
        for l in linhas:
            grupos.setdefault(semana(l), []).append(l)
        db = abrir(tmp / 'estado')
        treinos = 0
        for i, chave in enumerate(sorted(grupos), start=1):
            arq = tmp / f'lote_{i:02d}.csv'
            with arq.open('w', encoding=cfg['arquivo']['encoding'], newline='') as f:
                w = csv.DictWriter(f, fieldnames=cabecalho); w.writeheader(); w.writerows(grupos[chave])
            receber_lote(db, arq, cfg)
            antes = (tmp / 'estado' / 'modelo.json').read_text() if (tmp / 'estado' / 'modelo.json').exists() else None
            treinar(db, tmp / 'estado')
            depois = (tmp / 'estado' / 'modelo.json').read_text() if (tmp / 'estado' / 'modelo.json').exists() else None
            treinos += antes != depois
            painel = recalcular(db, tmp / 'estado', cfg, tmp / 'saida')
        receber_lote(db, tmp / 'lote_01.csv', cfg)  # reenvio do primeiro lote: nada pode entrar de novo
        final = recalcular(db, tmp / 'estado', cfg, tmp / 'saida')
        assert final['frota']['registros'] == len(linhas), 'algum registro se perdeu ou duplicou'
        assert final['frota']['falhas'] == sum(l[cfg['coluna_falha']] == cfg['valor_falha'] for l in linhas)
        assert final == {**painel, 'gerado_em': final['gerado_em'], 'lotes': final['lotes']}, 'reenvio mudou o painel'
        v = final['modelo']['validacao']
        assert final['modelo']['confiavel'], 'o modelo não superou o chute nas semanas que não tinha visto'
        print(f'\nSimulação OK: {len(grupos)} lotes semanais, {treinos} treinos, {final["frota"]["registros"]} registros, '
              f'reenvio ignorado. Teste do modelo nas semanas seguintes ({v["registros"]} registros que ele não tinha visto): '
              f'acerto {pct(v["acerto"])}, chute {pct(v["chute"])}.')
        db.close()  # no Windows o arquivo aberto impede apagar a pasta temporária


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('comando', nargs='?', default='completo',
                    choices=['lote', 'recalcular', 'treinar', 'semanal', 'completo', 'simular', 'acao'])
    ap.add_argument('arquivo', nargs='?', help='CSV do lote (comando lote) ou número da ação (comando acao)')
    ap.add_argument('--status', choices=['a fazer', 'em andamento', 'feita'], help='novo status da ação (comando acao)')
    ap.add_argument('--config', default=CONFIG_PADRAO, type=Path, help='tradutor de colunas do dataset')
    ap.add_argument('--estado', default=PASTA / 'estado', type=Path, help='pasta do histórico e do modelo')
    ap.add_argument('--saida', default=PASTA / 'resultados', type=Path, help='pasta dos resultados')
    a = ap.parse_args()
    cfg = json.loads(a.config.read_text(encoding='utf-8'))

    if a.comando == 'simular':
        return simular(cfg, a.arquivo or DATASET_PADRAO)
    if a.comando == 'completo':
        shutil.rmtree(a.estado, ignore_errors=True)
    db = abrir(a.estado)
    if a.comando in ('lote', 'completo'):
        receber_lote(db, a.arquivo or DATASET_PADRAO, cfg)
    if a.comando in ('lote', 'completo', 'treinar'):
        treinar(db, a.estado, forcar=a.comando == 'treinar')
    painel = recalcular(db, a.estado, cfg, a.saida)
    if a.comando == 'acao':
        plano = painel['plano_5w2h']
        if not (a.arquivo or '').isdigit() or not 1 <= int(a.arquivo) <= len(plano) or not a.status:
            raise SystemExit(f'Use: acao <1 a {len(plano)}> --status "a fazer"|"em andamento"|feita')
        arq = a.estado / 'acoes.json'
        status = json.loads(arq.read_text(encoding='utf-8')) if arq.exists() else {}
        # a data de conclusão é a data mais recente dos dados, a mesma régua usada nos prazos
        status[plano[int(a.arquivo) - 1]['id']] = dict(status=a.status, em=painel['periodo']['fim'])
        arq.write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding='utf-8')
        painel = recalcular(db, a.estado, cfg, a.saida)
        print(f'Ação {a.arquivo} marcada como "{a.status}".')
    if a.comando == 'semanal':
        texto = mensagem_whatsapp(painel)
        print(texto)
        print('\nPara enviar, abra este link e escolha o contato ou grupo:')
        print('https://wa.me/?text=' + urllib.parse.quote(texto))
    else:
        print((a.saida / 'resumo.md').read_text(encoding='utf-8'))


if __name__ == '__main__':
    main()
