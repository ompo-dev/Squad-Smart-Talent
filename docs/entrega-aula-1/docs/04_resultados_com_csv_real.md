# Resultados verificados a partir do Machine Downtime.csv

**Grupo 4 — Manufatura e Eficiência (OEE) · 30 de outubro de 2026**

**Fonte:** `machine_downtime.csv` (dataset público de manutenção; origem industrial não auditada). **Período:** 24/11/2021 a 03/07/2022. **Motor:** SQLite 3.

## Qualidade do dataset

- **2.500 linhas recebidas e 2.500 leituras válidas**, sem duplicatas após a limpeza e sem linhas descartadas por data/máquina/linha inválida.
- **3 máquinas** (`Makino-L1-Unit1-2013`, `Makino-L2-Unit1-2015`, `Makino-L3-Unit1-2015`) e **3 linhas de montagem** (`Shopfloor-L1/L2/L3`).
- **154 células corrigidas**: vazios, zeros em sensores físicos, negativos e valores fora da faixa física tornaram-se `null`; outliers estatísticos foram mantidos e sinalizados em `quality_issues`.
- **Rótulos de parada**: 1.265 leituras com `Machine_Failure` e 1.235 com `No_Machine_Failure`.
- **1.283 ocorrências críticas** no fato analítico: paradas, temperaturas críticas, vibrações críticas e pressões críticas. Uma mesma leitura pode gerar mais de uma ocorrência.
- Todas as chaves estrangeiras foram verificadas com `PRAGMA foreign_key_check`: **zero violações**.

## Cinco perguntas — interpretações com números reais

1. **WHERE + ORDER BY — Dez leituras mais graves:** a leitura de **30/03/2022** da **Makino-L1** acumula parada, vibração do spindle em **2,0 µm** e pressão hidráulica em **72,19 bar**, somando dois critérios críticos. O topo também inclui vibrações da ferramenta acima de 44 µm e pressões hidráulicas acima de 185 bar.
2. **GROUP BY — Linhas de montagem:** **Shopfloor-L1** tem **874 leituras e 454 paradas (51,95%)**; Shopfloor-L3 tem 818 leituras e 415 paradas (50,73%); Shopfloor-L2 tem 808 leituras e 396 paradas (49,01%). A taxa da frota é **50,6%**.
3. **JOIN — Distribuição por máquina:** **Makino-L1** concentra **458 ocorrências** (454 paradas, 3 vibrações críticas e 1 pressão crítica); **Makino-L3** soma 422; **Makino-L2** soma 403. O `LEFT JOIN` preserva as três máquinas na dimensão.
4. **HAVING — Máquinas acima da média:** **Makino-L1 (51,95%)** e **Makino-L3 (50,73%)** superam a taxa média de parada da frota (**50,6%**). Makino-L2 fica em 49,01%.
5. **Livre — Prioridade de manutenção:** **Makino-L1** e **Makino-L2** somam **3 de 4 pontos** e recebem prioridade alta; **Makino-L3** soma 2 pontos (prioridade média). As três apresentam tendência de **piora** na segunda metade do período. A Makino-L2 chama atenção pela temperatura máxima de **98,2 °C** em uma leitura isolada, sinalizada como outlier e mantida para investigação. Esta pontuação serve para *triagem de inspeção*, não determina parada automática.

## Cuidados na interpretação

- Os valores-limite são **hipóteses adotadas pelo grupo para exercício de dados**. Devem ser confrontados com parâmetros técnicos reais antes de qualquer recomendação operacional.
- A coluna `perda_leitura` indica informação ausente/inválida *dentro de uma amostra recebida*; não mede perda de pacotes ou amostras não recebidas.
- Não foram coletados tempo de parada, ciclos ideais e peças boas/rejeitadas. Portanto, **não é possível calcular o OEE nem separar suas perdas de Disponibilidade, Desempenho e Qualidade com estes dados**. Os alertas são sinais indiretos de possíveis causas.
- As taxas usam leituras como denominador, não peças produzidas.

## Reprodutibilidade

Os cinco resultados detalhados estão em `resultado_consulta_1.csv` até `resultado_consulta_5.csv`; os `SELECTs` estão em `02_cinco_consultas_SQLite.sql`, e o banco completo com importação está em `grupo4_machine_downtime.db`. A referência de integridade do CSV está em `05_resumo_validacao.json` (SHA-256).
