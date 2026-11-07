"""Gera os dois gráficos conclusivos da triagem de manutenção em PNG.

Uso:
    python src/graficos.py                                   # base entregue na Aula 1 (SQLite)
    python src/graficos.py --input reports/pandas/telemetry_clean.csv --output reports/pandas

Dentro de um pipeline: gerar_graficos(leituras_limpas, pasta_de_saida).
Os critérios e os arredondamentos são os das consultas 2 e 5 de
docs/entrega-aula-1/sql/02_cinco_consultas_SQLite.sql; tests/test_graficos.py confere os números.
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
import textwrap
from contextlib import closing
from math import sqrt
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # sem janela: funciona em Docker e em servidor
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
BASE_ENTREGUE = ROOT / "docs" / "entrega-aula-1" / "dados" / "grupo4_machine_downtime.db"

# Faixas críticas (mínimo, máximo) de triagem, iguais às de lib/telemetry-schema.ts.
FAIXAS_CRITICAS = {
    "temperatura": {
        "coolant_temperature_c": (None, 45),
        "hydraulic_oil_temperature_c": (None, 60),
        "spindle_bearing_temperature_c": (None, 47),
    },
    "vibracao": {"spindle_vibration_um": (None, 1.95), "tool_vibration_um": (None, 44)},
    "pressao": {
        "hydraulic_pressure_bar": (40, 185),
        "coolant_pressure_bar": (2, 9),
        "air_system_pressure_bar": (4, 8),
    },
}
OUTROS_SENSORES = ["spindle_speed_rpm", "voltage_v", "torque_nm", "cutting_kn"]
SENSORES = [coluna for grupo in FAIXAS_CRITICAS.values() for coluna in grupo] + OUTROS_SENSORES
COLUNAS = ["machine_id", "assembly_line", "date", "downtime", *SENSORES]
TEMPERATURA_CRITICA_C = 45
# shortcut: corte fixo igual ao da consulta 5, rever junto com a consulta quando entrarem dados novos.
CORTE_PERIODOS = pd.Timestamp("2022-03-26", tz="UTC")

COR_DESTAQUE = "#2a78d6"
COR_DEMAIS = "#a9c8ee"
COR_MARCADO = "#dcebfb"
COR_TEXTO = "#1f1f1e"
COR_APOIO = "#5f5e5a"
COR_LINHA = "#d9d8d3"
COR_FUNDO = "#fcfcfb"


def decimal(valor: float, casas: int = 2) -> str:
    return f"{valor:.{casas}f}".replace(".", ",")


def juntar(nomes: list[str]) -> str:
    return nomes[0] if len(nomes) == 1 else f"{', '.join(nomes[:-1])} e {nomes[-1]}"


def preparar(leituras: pd.DataFrame) -> pd.DataFrame:
    faltando = [coluna for coluna in COLUNAS if coluna not in leituras.columns]
    if faltando:
        raise ValueError(f"colunas ausentes nas leituras limpas: {', '.join(faltando)}")
    if leituras.empty:
        raise ValueError("não há leituras para gerar os gráficos")
    base = leituras[COLUNAS].copy()
    base["date"] = pd.to_datetime(base["date"], utc=True, format="mixed")
    # Aceita 0/1 (SQLite) e True/False (CSV do pipeline); rótulo ausente continua ausente.
    base["falha"] = base["downtime"].map({True: 1.0, False: 0.0, "True": 1.0, "False": 0.0})
    for coluna in SENSORES:
        base[coluna] = pd.to_numeric(base[coluna], errors="coerce")
    base["incompleta"] = base[SENSORES].isna().any(axis=1).astype(int)
    base["alertas"] = (base["falha"] == 1).astype(int)
    for grupo in FAIXAS_CRITICAS.values():
        critica = pd.Series(False, index=base.index)
        for coluna, (minimo, maximo) in grupo.items():
            if minimo is not None:
                critica |= base[coluna] < minimo
            if maximo is not None:
                critica |= base[coluna] > maximo
        base["alertas"] += critica.astype(int)
    return base


def margem_95(falhas: float, leituras: float) -> tuple[float, float]:
    """Intervalo de Wilson de 95%, em pontos percentuais."""
    z = 1.96
    taxa = falhas / leituras
    divisor = 1 + z**2 / leituras
    centro = (taxa + z**2 / (2 * leituras)) / divisor
    meia = z * sqrt(taxa * (1 - taxa) / leituras + z**2 / (4 * leituras**2)) / divisor
    return 100 * (centro - meia), 100 * (centro + meia)


def tabela_linhas(leituras: pd.DataFrame) -> pd.DataFrame:
    """Consulta 2: taxa de falhas por linha, sobre as leituras com rótulo conhecido."""
    base = preparar(leituras)
    linhas = []
    for linha, grupo in base.groupby("assembly_line"):
        analisadas = int(grupo["falha"].notna().sum())
        falhas = int(grupo["falha"].sum())
        minimo, maximo = margem_95(falhas, analisadas) if analisadas else (float("nan"), float("nan"))
        linhas.append({
            "assembly_line": linha,
            "leituras": len(grupo),
            "leituras_analisadas": analisadas,
            "paradas": falhas,
            "taxa_parada_pct": round(100 * falhas / analisadas, 2) if analisadas else float("nan"),
            "margem_min_pct": round(minimo, 2),
            "margem_max_pct": round(maximo, 2),
        })
    tabela = pd.DataFrame(linhas)
    return tabela.sort_values(["taxa_parada_pct", "assembly_line"], ascending=[False, True]).reset_index(drop=True)


def tabela_prioridade(leituras: pd.DataFrame) -> pd.DataFrame:
    """Consulta 5: quatro critérios de triagem, um ponto por critério atendido."""
    base = preparar(leituras)
    frota_alertas = base["alertas"].mean()
    frota_incompletas = base["incompleta"].mean()
    maquinas = []
    for maquina, grupo in base.groupby("machine_id"):
        antes = grupo[grupo["date"] < CORTE_PERIODOS]["alertas"]
        depois = grupo[grupo["date"] >= CORTE_PERIODOS]["alertas"]
        comparavel = len(antes) > 0 and len(depois) > 0
        taxa_antes, taxa_depois = (antes.mean(), depois.mean()) if comparavel else (float("nan"), float("nan"))
        temperatura = grupo["coolant_temperature_c"].max()
        criterios = {
            "acima_media_alertas": int(grupo["alertas"].mean() > frota_alertas),
            "acima_media_incompletas": int(grupo["incompleta"].mean() > frota_incompletas),
            "atingiu_temperatura_critica": int(temperatura >= TEMPERATURA_CRITICA_C),
            "taxa_em_alta": int(comparavel and taxa_depois > taxa_antes),
        }
        pontos = sum(criterios.values())
        if not comparavel:
            tendencia = "Sem comparação"
        elif taxa_depois > taxa_antes:
            tendencia = "Piorando"
        elif taxa_depois < taxa_antes:
            tendencia = "Melhorando"
        else:
            tendencia = "Estável"
        maquinas.append({
            "machine_id": maquina,
            "pontos_prioridade": pontos,
            "prioridade": "Alta - inspecionar com urgência" if pontos >= 3
            else "Média - agendar inspeção" if pontos == 2 else "Baixa - monitorar",
            "leituras": len(grupo),
            "alertas_criticos": int(grupo["alertas"].sum()),
            "alertas_por_100_leituras": round(100 * grupo["alertas"].mean(), 2),
            "leituras_incompletas_pct": round(100 * grupo["incompleta"].mean(), 2),
            "temperatura_maxima_c": round(temperatura, 1),
            "alertas_por_100_sem1": round(100 * taxa_antes, 2),
            "alertas_por_100_sem2": round(100 * taxa_depois, 2),
            "tendencia": tendencia,
            **criterios,
            "leituras_temperatura_critica": int((grupo["coolant_temperature_c"] >= TEMPERATURA_CRITICA_C).sum()),
            "frota_alertas_por_100": round(100 * frota_alertas, 2),
            "frota_incompletas_pct": round(100 * frota_incompletas, 2),
        })
    # Dentro do empate a ordem é só alfabética, para não sugerir uma vencedora.
    return pd.DataFrame(maquinas).sort_values(["pontos_prioridade", "machine_id"], ascending=[False, True]).reset_index(drop=True)


def contagem_leituras(total: int) -> str:
    return "1 leitura" if total == 1 else f"{total} leituras"


def nota_temperatura(tabela: pd.DataFrame) -> str | None:
    isoladas = tabela[(tabela["atingiu_temperatura_critica"] == 1) & (tabela["leituras_temperatura_critica"] == 1)]
    if isoladas.empty:
        return None
    return f"Atenção: em {juntar(list(isoladas['machine_id']))}, o critério de temperatura vem de uma única leitura; confira se não é erro de sensor."


def lideres_linhas(tabela: pd.DataFrame) -> pd.DataFrame:
    return tabela[tabela["taxa_parada_pct"] == tabela["taxa_parada_pct"].max()]


def lideres_prioridade(tabela: pd.DataFrame) -> pd.DataFrame:
    return tabela[tabela["pontos_prioridade"] == tabela["pontos_prioridade"].max()]


def titulo_linhas(tabela: pd.DataFrame) -> str:
    lideres = lideres_linhas(tabela)
    if lideres.empty:
        return "Sem leituras com rótulo de falha para comparar as linhas"
    nomes = juntar(list(lideres["assembly_line"]))
    taxa = decimal(lideres["taxa_parada_pct"].iloc[0])
    if len(lideres) == 1:
        return f"Linha {nomes} apresenta a maior taxa de falhas: {taxa}%"
    return f"Linhas {nomes} empatam na maior taxa de falhas: {taxa}%"


def nota_linhas(tabela: pd.DataFrame) -> str:
    validas = tabela.dropna(subset=["taxa_parada_pct"])
    if len(validas) < 2:
        return "Só há uma linha com rótulos; não há comparação."
    maior, menor = validas.iloc[0], validas.iloc[-1]
    diferenca = decimal(maior["taxa_parada_pct"] - menor["taxa_parada_pct"])
    if maior["margem_min_pct"] <= menor["margem_max_pct"]:
        return f"Diferença de {diferenca} p.p. entre a maior e a menor taxa. As margens de 95% se sobrepõem: a diferença pode ser acaso."
    return f"Diferença de {diferenca} p.p. entre a maior e a menor taxa. As margens de 95% não se sobrepõem."


def titulo_prioridade(tabela: pd.DataFrame) -> str:
    lideres = lideres_prioridade(tabela)
    pontos = int(lideres["pontos_prioridade"].iloc[0])
    if pontos == 0:
        return "Nenhuma máquina atende aos critérios de triagem"
    nomes = juntar(list(lideres["machine_id"]))
    if len(lideres) == 1:
        return f"{nomes} vem primeiro na inspeção: {pontos} de 4 critérios"
    return f"{nomes} empatam na prioridade de inspeção: {pontos} de 4 critérios"


def novo_grafico(largura: float, altura: float, titulo: str, pergunta: str, notas: list[str]):
    figura = plt.figure(figsize=(largura, altura), facecolor=COR_FUNDO)
    figura.text(0.03, 1 - 0.32 / altura, titulo, fontsize=14.5, fontweight="bold", color=COR_TEXTO, va="top")
    figura.text(0.03, 1 - 0.68 / altura, pergunta, fontsize=10.5, color=COR_APOIO, va="top")
    rodape = "\n".join(linha for nota in notas for linha in textwrap.wrap(nota, width=int(largura * 13.5)))
    figura.text(0.03, 0.13 / altura, rodape, fontsize=8.8, color=COR_APOIO, va="bottom", linespacing=1.4)
    return figura, (rodape.count("\n") + 1) * 0.19 + 0.2


def eixo_limpo(eixo) -> None:
    eixo.set_facecolor(COR_FUNDO)
    for lado in ("top", "right", "left"):
        eixo.spines[lado].set_visible(False)
    eixo.spines["bottom"].set_color(COR_LINHA)
    eixo.tick_params(axis="both", length=0, colors=COR_APOIO, labelsize=9.5)
    eixo.grid(axis="x", color=COR_LINHA, linewidth=0.7)
    eixo.set_axisbelow(True)


def grafico_linhas(tabela: pd.DataFrame, frota_pct: float | None, destino: Path) -> None:
    lideres = set(lideres_linhas(tabela)["assembly_line"])
    altura = 3.4 + 0.62 * len(tabela)
    frota = f"Com {decimal(frota_pct)}% das leituras com falha na frota, isto" if frota_pct is not None else "Isto"
    figura, rodape = novo_grafico(10.5, altura, titulo_linhas(tabela), "Qual linha apresenta maior proporção de leituras com falha?", [
        nota_linhas(tabela),
        "Taxa = leituras com falha ÷ leituras com rótulo conhecido. Barra fina = margem de 95% (Wilson). "
        f"{frota} compara registros da base: não mede frequência real de quebra, duração de parada nem OEE.",
    ])
    eixo = figura.add_axes([0.16, (rodape + 0.5) / altura, 0.81, 1 - (rodape + 0.5 + 1.05) / altura])
    eixo_limpo(eixo)
    posicoes = list(range(len(tabela)))
    taxas = tabela["taxa_parada_pct"].fillna(0)
    cores = [COR_DESTAQUE if nome in lideres else COR_DEMAIS for nome in tabela["assembly_line"]]
    eixo.barh(posicoes, taxas, color=cores, height=0.58)
    for posicao, (_, linha) in zip(posicoes, tabela.iterrows()):
        if pd.isna(linha["taxa_parada_pct"]):
            eixo.text(1, posicao, f"Sem rótulo de falha · {linha['leituras']} leituras", va="center", fontsize=9.5, color=COR_APOIO)
            continue
        eixo.plot([linha["margem_min_pct"], linha["margem_max_pct"]], [posicao, posicao], color=COR_TEXTO, linewidth=1.2, solid_capstyle="butt")
        eixo.text(linha["margem_max_pct"] + 1, posicao,
                  f"{decimal(linha['taxa_parada_pct'])}% · {linha['paradas']} de {linha['leituras_analisadas']} leituras",
                  va="center", fontsize=10, color=COR_TEXTO)
    if frota_pct is not None:
        eixo.axvline(frota_pct, color=COR_APOIO, linewidth=1, linestyle=(0, (4, 3)))
        eixo.text(frota_pct, -0.62, f"Frota: {decimal(frota_pct)}%", ha="center", va="bottom", fontsize=9, color=COR_APOIO)
    eixo.set_yticks(posicoes, tabela["assembly_line"])
    eixo.set_ylim(len(tabela) - 0.5, -0.62)
    eixo.set_xlim(0, 100)
    eixo.xaxis.set_major_formatter(lambda valor, _: f"{valor:.0f}%")
    eixo.set_xlabel("Leituras com falha (% das leituras analisadas de cada linha)", fontsize=9.5, color=COR_APOIO)
    figura.savefig(destino, dpi=170, facecolor=COR_FUNDO)
    plt.close(figura)


def grafico_prioridade(tabela: pd.DataFrame, destino: Path) -> None:
    lideres = lideres_prioridade(tabela)
    topo = int(lideres["pontos_prioridade"].iloc[0])
    empatadas = set(lideres["machine_id"]) if len(lideres) > 1 else set()
    primeira = tabela.iloc[0]
    altura = 4.5 + 0.72 * len(tabela)
    aviso = nota_temperatura(tabela)
    figura, rodape = novo_grafico(12.5, altura, titulo_prioridade(tabela), "Quais máquinas merecem investigação primeiro e por quê?", [
        *([aviso] if aviso else []),
        "Alerta = falha registrada ou temperatura, vibração ou pressão em faixa crítica; uma leitura soma até 4 alertas.",
        "Cada critério atendido vale 1 ponto (Alta: 3 ou 4 · Média: 2 · Baixa: 0 ou 1). Empate é a mesma pontuação; dentro dele a ordem é alfabética. "
        f"Corte de período em {CORTE_PERIODOS:%d/%m/%Y}, igual à consulta 5.",
        "É triagem para decidir onde olhar primeiro: não é diagnóstico nem previsão de falha. "
        "Estes dados não têm a duração das paradas e não permitem calcular OEE.",
    ])
    baixo = (rodape + 0.52) / altura
    alto = 1 - 1.55 / altura
    barras = figura.add_axes([0.2, baixo, 0.2, alto - baixo])
    grade = figura.add_axes([0.42, baixo, 0.555, alto - baixo], sharey=barras)
    eixo_limpo(barras)
    posicoes = list(range(len(tabela)))
    cores = [COR_DESTAQUE if pontos == topo and topo > 0 else COR_DEMAIS for pontos in tabela["pontos_prioridade"]]
    barras.barh(posicoes, tabela["pontos_prioridade"], color=cores, height=0.58)
    rotulos = []
    for posicao, (_, maquina) in zip(posicoes, tabela.iterrows()):
        barras.text(maquina["pontos_prioridade"] + 0.1, posicao, str(maquina["pontos_prioridade"]), va="center", fontsize=11, fontweight="bold", color=COR_TEXTO)
        faixa = maquina["prioridade"].split(" - ")[0]
        rotulos.append(f"{maquina['machine_id']}\n{faixa}{' · empate' if maquina['machine_id'] in empatadas else ''}")
    barras.set_yticks(posicoes, rotulos)
    barras.set_ylim(len(tabela) - 0.5, -0.5)
    barras.set_xlim(0, 4.5)
    barras.set_xticks(range(5))
    barras.set_xlabel("Pontos (critérios atendidos, de 0 a 4)", fontsize=9.5, color=COR_APOIO)

    colunas = [
        ("acima_media_alertas", f"Alertas acima da média\nda frota ({decimal(primeira['frota_alertas_por_100'])} por 100)",
         lambda m: f"{decimal(m['alertas_por_100_leituras'])} por 100"),
        ("acima_media_incompletas", f"Incompletas acima da\nmédia da frota ({decimal(primeira['frota_incompletas_pct'])}%)",
         lambda m: f"{decimal(m['leituras_incompletas_pct'])}%"),
        ("atingiu_temperatura_critica", f"Refrigerante atingiu\n{TEMPERATURA_CRITICA_C} °C ou mais",
         lambda m: f"máx. {decimal(m['temperatura_maxima_c'], 1)} °C · {contagem_leituras(m['leituras_temperatura_critica'])}"),
        ("taxa_em_alta", "Alertas por 100 leituras\nsubiram no 2º período",
         lambda m: f"{decimal(m['alertas_por_100_sem1'])} → {decimal(m['alertas_por_100_sem2'])}"),
    ]
    grade.set_facecolor(COR_FUNDO)
    grade.axis("off")
    grade.set_xlim(0, 4)
    for indice, (criterio, cabecalho, valor) in enumerate(colunas):
        grade.text(indice + 0.5, -0.6, cabecalho, ha="center", va="bottom", fontsize=8.8, fontweight="bold", color=COR_TEXTO, linespacing=1.3)
        for posicao, (_, maquina) in zip(posicoes, tabela.iterrows()):
            atendeu = bool(maquina[criterio])
            grade.add_patch(plt.Rectangle((indice + 0.03, posicao - 0.42), 0.94, 0.84, facecolor=COR_MARCADO if atendeu else "#f3f2ee", edgecolor="none"))
            grade.text(indice + 0.5, posicao - 0.13, "✓ atende" if atendeu else "– não atende", ha="center", va="center", fontsize=9.5,
                       fontweight="bold" if atendeu else "normal", color=COR_TEXTO if atendeu else COR_APOIO)
            grade.text(indice + 0.5, posicao + 0.17, valor(maquina), ha="center", va="center", fontsize=9.2, color=COR_TEXTO if atendeu else COR_APOIO)
    figura.savefig(destino, dpi=170, facecolor=COR_FUNDO)
    plt.close(figura)


def gerar_graficos(leituras: pd.DataFrame, saida: Path | str) -> dict[str, str]:
    """Grava os dois PNGs e as tabelas de conferência em `saida`; devolve os títulos calculados."""
    saida = Path(saida)
    saida.mkdir(parents=True, exist_ok=True)
    linhas = tabela_linhas(leituras)
    prioridade = tabela_prioridade(leituras)
    falha = preparar(leituras)["falha"]
    frota = round(100 * falha.mean(), 2) if falha.notna().any() else None
    linhas.to_csv(saida / "falhas_por_linha.csv", sep=";", index=False, encoding="utf-8")
    prioridade.to_csv(saida / "prioridade_por_maquina.csv", sep=";", index=False, encoding="utf-8")
    grafico_linhas(linhas, frota, saida / "taxa_falhas_por_linha.png")
    grafico_prioridade(prioridade, saida / "prioridade_inspecao_por_maquina.png")
    return {"linhas": titulo_linhas(linhas), "prioridade": titulo_prioridade(prioridade)}


def ler_leituras(origem: Path) -> pd.DataFrame:
    if not origem.is_file():
        raise ValueError(f"arquivo não encontrado: {origem}")
    if origem.suffix.lower() == ".db":
        with closing(sqlite3.connect(origem)) as conexao:
            return pd.read_sql_query(f"SELECT {', '.join(COLUNAS)} FROM telemetria_limpa", conexao)
    return pd.read_csv(origem, encoding="utf-8-sig")


def main() -> int:
    # O console do Windows não usa UTF-8 quando a saída vai para log ou pipe.
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    argumentos = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    argumentos.add_argument("--input", type=Path, default=ROOT / "reports" / "pandas" / "telemetry_clean.csv", help="telemetry_clean.csv do pipeline ou banco SQLite da Aula 1 (fallback)")
    argumentos.add_argument("--output", type=Path, default=ROOT / "reports" / "pandas")
    opcoes = argumentos.parse_args()
    try:
        titulos = gerar_graficos(ler_leituras(opcoes.input), opcoes.output)
    except (ValueError, OSError, sqlite3.Error, pd.errors.ParserError) as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 1
    print(f"Base: {opcoes.input}\nSaída: {opcoes.output}")
    for titulo in titulos.values():
        print(f"- {titulo}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
