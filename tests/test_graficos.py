"""Confere os gráficos contra as tabelas da Aula 1.  Rodar: python -m unittest tests/test_graficos.py"""
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
import graficos  # noqa: E402

RESULTADOS = ROOT / "docs" / "entrega-aula-1" / "resultados"


def leitura(maquina="M1", linha="L1", falha=0, **sensores):
    base = {coluna: 10.0 for coluna in graficos.SENSORES}
    base["hydraulic_pressure_bar"] = 100.0
    base["coolant_pressure_bar"] = 5.0
    base["air_system_pressure_bar"] = 6.0
    base["spindle_vibration_um"] = 1.0
    base["date"] = "2022-01-01T00:00:00+00:00"
    return {"machine_id": maquina, "assembly_line": linha, "downtime": falha, **base, **sensores}


class ConferenciaComAsTabelas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from src.pipeline import run_pipeline

        cls._saida = tempfile.TemporaryDirectory()
        pasta = Path(cls._saida.name) / "pandas"
        run_pipeline(ROOT / "data" / "machine_downtime.csv", pasta)
        cls.leituras = graficos.ler_leituras(pasta / "telemetry_clean.csv")

    @classmethod
    def tearDownClass(cls):
        cls._saida.cleanup()

    def test_taxa_por_linha_igual_a_consulta_2(self):
        origem = pd.read_csv(RESULTADOS / "resultado_consulta_2.csv", sep=";").set_index("assembly_line")
        calculada = graficos.tabela_linhas(self.leituras).set_index("assembly_line")
        self.assertEqual(set(origem.index), set(calculada.index))
        for coluna in ("leituras", "paradas", "taxa_parada_pct"):
            pd.testing.assert_series_equal(origem[coluna], calculada.loc[origem.index, coluna], check_dtype=False)

    def test_prioridade_igual_a_consulta_5(self):
        origem = pd.read_csv(RESULTADOS / "resultado_consulta_5.csv", sep=";").set_index("machine_id")
        calculada = graficos.tabela_prioridade(self.leituras).set_index("machine_id").loc[origem.index]
        for coluna in origem.columns:
            pd.testing.assert_series_equal(origem[coluna], calculada[coluna], check_dtype=False)

    def test_alertas_iguais_as_marcacoes_do_banco(self):
        if not graficos.BASE_ENTREGUE.is_file():
            self.skipTest("Banco SQLite da Aula 1 removido conforme exig�ncia da Task 5")
        with closing(sqlite3.connect(graficos.BASE_ENTREGUE)) as conexao:
            esperado = pd.read_sql_query(
                "SELECT def_parada + def_temperatura_critica + def_vibracao_critica + def_pressao_critica AS total, "
                "perda_leitura FROM telemetria_limpa", conexao)
        base = graficos.preparar(self.leituras)
        self.assertEqual(esperado["total"].tolist(), base["alertas"].tolist())
        self.assertEqual(esperado["perda_leitura"].tolist(), base["incompleta"].tolist())


class TitulosCalculados(unittest.TestCase):
    def test_lider_vem_dos_dados(self):
        dados = pd.DataFrame([leitura(linha="Azul", falha=1), leitura(linha="Azul", falha=1), leitura(linha="Verde", falha=0), leitura(linha="Verde", falha=1)])
        self.assertEqual(graficos.titulo_linhas(graficos.tabela_linhas(dados)), "Linha Azul apresenta a maior taxa de falhas: 100,00%")

    def test_empate_de_linhas_nao_inventa_vencedora(self):
        dados = pd.DataFrame([leitura(linha="Azul", falha=1), leitura(linha="Azul", falha=0), leitura(linha="Verde", falha=1), leitura(linha="Verde", falha=0)])
        self.assertEqual(graficos.titulo_linhas(graficos.tabela_linhas(dados)), "Linhas Azul e Verde empatam na maior taxa de falhas: 50,00%")

    def test_empate_de_maquinas_nao_inventa_vencedora(self):
        dados = pd.DataFrame([leitura(maquina="A", coolant_temperature_c=50), leitura(maquina="B", coolant_temperature_c=50), leitura(maquina="C")])
        self.assertEqual(graficos.titulo_prioridade(graficos.tabela_prioridade(dados)), "A e B empatam na prioridade de inspeção: 2 de 4 critérios")

    def test_rotulo_ausente_fica_fora_da_taxa_sem_virar_zero(self):
        dados = pd.DataFrame([leitura(linha="Azul", falha=None), leitura(linha="Verde", falha=1)])
        tabela = graficos.tabela_linhas(dados).set_index("assembly_line")
        self.assertTrue(pd.isna(tabela.loc["Azul", "taxa_parada_pct"]))
        self.assertEqual(tabela.loc["Azul", "leituras_analisadas"], 0)
        self.assertEqual(graficos.titulo_linhas(tabela.reset_index()), "Linha Verde apresenta a maior taxa de falhas: 100,00%")

    def test_temperatura_de_uma_leitura_so_gera_aviso(self):
        tabela = graficos.tabela_prioridade(pd.DataFrame([leitura(maquina="A", coolant_temperature_c=50), leitura(maquina="A"), leitura(maquina="B")]))
        self.assertIn("em A,", graficos.nota_temperatura(tabela))
        tabela = graficos.tabela_prioridade(pd.DataFrame([leitura(maquina="A", coolant_temperature_c=50), leitura(maquina="A", coolant_temperature_c=50)]))
        self.assertIsNone(graficos.nota_temperatura(tabela))

    def test_nenhum_criterio(self):
        dados = pd.DataFrame([leitura()])
        self.assertEqual(graficos.titulo_prioridade(graficos.tabela_prioridade(dados)), "Nenhuma máquina atende aos critérios de triagem")


class Execucao(unittest.TestCase):
    def test_gera_pngs_sem_janela(self):
        with tempfile.TemporaryDirectory() as pasta:
            feito = subprocess.run([sys.executable, str(ROOT / "src" / "graficos.py"), "--output", pasta], capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(feito.returncode, 0, feito.stderr)
            for nome in ("taxa_falhas_por_linha.png", "prioridade_inspecao_por_maquina.png"):
                self.assertGreater((Path(pasta) / nome).stat().st_size, 10_000)
        self.assertEqual(graficos.matplotlib.get_backend().lower(), "agg")

    def test_entrada_invalida_da_erro_claro(self):
        feito = subprocess.run([sys.executable, str(ROOT / "src" / "graficos.py"), "--input", "nao_existe.csv"], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(feito.returncode, 1)
        self.assertTrue(feito.stderr.startswith("Erro:"), feito.stderr)

    def test_grupo_sem_rotulo_e_base_vazia(self):
        with tempfile.TemporaryDirectory() as pasta:
            dados = pd.DataFrame([leitura(linha="Azul", falha=None), leitura(linha="Verde", falha=None)])
            titulos = graficos.gerar_graficos(dados, pasta)
            self.assertIn("Sem leituras", titulos["linhas"])
            with self.assertRaises(ValueError):
                graficos.gerar_graficos(dados.iloc[0:0], pasta)


if __name__ == "__main__":
    unittest.main()
