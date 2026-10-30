# Resultados verificados a partir do CSV entregue pelo grupo

**Grupo 4 — Manufatura e Eficiência (OEE) · 30 de outubro de 2026**

**Fonte:** `telemetria_suja.csv` (CSV fornecido nesta conversa; sua origem industrial não foi auditada). **Período:** 1º–14/05/2026. **Motor:** SQLite 3.

## Qualidade do dataset

- **4.060 linhas recebidas**, 60 repetições literalmente idênticas por `id_leitura`; após deduplicação, **4.000 leituras**.
- **24 máquinas distintas**, 3 turnos **inferidos do horário**: A 06–13h59, B 14–21h59, C 22–05h59. A escala real não foi informada.
- **298 ocorrências:** 6 alertas de superaquecimento (≥100 °C); 21 vibrações altas (>4,5 mm/s); 0 pressões baixas (<20 psi); 271 leituras incompletas (campo essencial ausente/inválido). Uma leitura gera dois eventos, logo as ocorrências não representam 298 leituras distintas.
- Entre as 4.000 linhas válidas, existem **160 pressões ausentes, 80 vibrações ausentes e 40 valores de RPM inválidos (-999)**; as 271 leituras incompletas são a união dessas falhas (há sobreposições entre elas).
- Todas as chaves estrangeiras foram verificadas com `PRAGMA foreign_key_check`: **zero violações**.

## Cinco perguntas — interpretações com números reais

1. **WHERE + ORDER BY — Dez eventos mais graves:** a leitura **4238**, máquina **7**, registrada em **05/05/2026 às 06h30**, apresenta **104,1 °C** e ausência de pressão de óleo; aciona dois indicadores e lidera o ranking por alertas simultâneos.
2. **GROUP BY — Alertas por turno:** o turno **A** apresenta **13 alertas de sensor em 1.348 leituras (0,96 a cada 100)**. Por outro lado, o turno **C** apresenta o maior percentual de leituras incompletas (**7,29%**); portanto, o turno de maior concentração de alertas não é o mesmo com maior incompletude.
3. **JOIN — Distribuição por máquina:** as máquinas **5** (faixa Média) e **21** (faixa Alta) empatam com **18 ocorrências** cada, considerando tanto alertas de sensor quanto leituras incompletas. O relacionamento preserva todas as 24 máquinas.
4. **HAVING — Máquinas acima da média:** **6 máquinas** superam a média ponderada da frota de **0,68 alertas de sensor a cada 100 leituras**. A máquina **5** lidera, com **3,35 por 100 leituras** (6 alertas em 179 leituras).
5. **Livre — Prioridade de manutenção:** a máquina **22** soma **4 de 4 pontos**, apresenta **105 °C** de temperatura máxima, **8,00%** de leituras incompletas e a taxa de alertas aumenta de **0,00 para 3,23 a cada 100 leituras** na segunda semana. As máquinas **9** e **11** aparecem depois, com 3 pontos cada. Esta pontuação serve para *triagem de inspeção*, não determina parada automática.

## Cuidados na interpretação

- Os valores-limite foram **hipóteses adotadas pelo grupo para exercício de dados**. Devem ser confrontados com parâmetros técnicos reais antes de qualquer recomendação operacional.
- A coluna `perda_leitura` indica informação ausente/inválida *dentro de uma amostra recebida*; não mede perda de pacotes ou amostras não recebidas.
- Não foram coletados tempo de parada, ciclos ideais e peças boas/rejeitadas. Portanto, **não é possível calcular o OEE nem separar suas perdas de Disponibilidade, Desempenho e Qualidade com estes dados**. Os alertas são sinais indiretos de possíveis causas.
- As taxas de alertas usam leituras como denominador, não peças produzidas. Isso evita chamar de “taxa de defeitos de qualidade” algo que mede sensores.

## Reprodutibilidade

Os cinco resultados detalhados estão em `resultado_consulta_1.csv` até `resultado_consulta_5.csv`; os `SELECTs` estão em `02_cinco_consultas_SQLite.sql`, e o banco completo com importação está no pacote técnico. A referência de integridade do CSV está em `05_resumo_validacao.json` (SHA-256).
