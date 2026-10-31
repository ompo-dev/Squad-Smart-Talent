# Grupo 4 — Manufatura e Eficiência (OEE)
**Smart Talent John Deere — Remoto 01 — Aula 1 — 30/10/2026**

## Parte 1 — Cinco perguntas, SQL e interpretação

O arquivo **`02_cinco_consultas_SQLite.sql`** contém as cinco perguntas de negócio, as consultas no dialeto **SQLite 3** e **uma frase de interpretação por consulta**:

1. **Filtro e ordenação:** quais são as dez leituras com mais critérios críticos simultâneos? A triagem considera parada, temperatura, vibração e pressão. **Interpretação:** o topo combina parada com vibração da ferramenta acima de 44 µm ou pressão hidráulica fora de 40–185 bar.
2. **Agregação e GROUP BY:** qual linha de montagem concentra mais paradas e leituras incompletas? **Interpretação:** Shopfloor-L1 lidera com 874 leituras e 454 paradas (51,95%), seguida por L3 (50,73%) e L2 (49,01%).
3. **JOIN:** quais máquinas concentram cada tipo de ocorrência crítica? **Interpretação:** Makino-L1 soma 458 ocorrências, Makino-L3 422 e Makino-L2 403, incluindo paradas, temperaturas, vibrações e pressões críticas.
4. **HAVING/subconsulta:** quais máquinas têm taxa de parada acima da média da frota? **Interpretação:** apenas Makino-L1 (51,95%) e Makino-L3 (50,73%) superam a média de 50,6%.
5. **Consulta livre — gestor:** quais máquinas devem ser priorizadas para inspeção e sua condição está piorando ou melhorando? **Interpretação:** Makino-L1 e Makino-L2 somam 3/4 critérios (prioridade alta) e Makino-L3 soma 2/4; as três mostram tendência de piora entre as metades do período.

As consultas foram **executadas no Machine Downtime.csv**, com 2.500 leituras de origem, 2.500 leituras limpas, 3 máquinas, 3 linhas de montagem e 1.283 ocorrências críticas. A limpeza corrigiu 154 células (vazios, zeros, negativos ou valores fora da faixa física). Consulte `04_resultados_com_csv_real.md` e os cinco CSVs de saída para números e ressalvas completos.

## Parte 2 — Modelo de dados

Arquivos: **`modelo_relacional.png`** (imagem), **`modelo_relacional.pdf`** (alta qualidade), **`01_modelo_sqlite.sql`** (DDL), **`03_desafio_dimensao_distinct.sql`** (desafio opcional).

Entidades e relacionamentos:

- **`telemetria_suja`:** contém o CSV bruto com os valores originais, preservando registros problemáticos.
- **`dim_maquina`:** uma linha por máquina, com `machine_id` como chave primária.
- **`telemetria_limpa`:** uma linha por leitura, com `record_key` (SHA-256) como chave primária e `machine_id` como chave estrangeira. Uma máquina tem muitas leituras (1:N).
- **`fato_ocorrencia`:** uma linha por tipo de alerta, com `id_ocorrencia` como chave primária, `record_key` e `machine_id` como chaves estrangeiras. Uma leitura pode ter zero, uma ou várias ocorrências (1:0..N).

A chave primária própria de ocorrências corrige a ambiguidade do esboço inicial, em que várias ocorrências podiam compartilhar a mesma leitura.

## Parte 3 — Preparação do Sábado 2

A verificação de conta GitHub com 2FA, Docker Desktop + `docker run hello-world`, conclusão dos dois EADs e atualização do board depende de comprovação por cada integrante. **Nenhum item está sendo declarado concluído sem confirmação.** O arquivo `preparacao_sabado2.md`, nesta mesma pasta, contém o checklist e as tarefas do board com campo para responsáveis.

## Limitações e hipóteses

Os limites de triagem adotados são: refrigerante >45 °C, óleo hidráulico >60 °C, mancal >47 °C, vibração do spindle >1,95 µm, vibração da ferramenta >44 µm, pressão hidráulica <40 ou >185 bar, pressão do refrigerante <2 ou >9 bar e pressão do ar <4 ou >8 bar. São **critérios ilustrativos de triagem**, não limites garantidos pelo fabricante. A variável `perda_leitura` assinala campos essenciais ausentes ou inválidos **na linha recebida**, não ausência de amostras no transporte.

**OEE = Disponibilidade × Desempenho × Qualidade**, mas o conjunto informado não possui durações de paradas, tempo de produção planejado, ciclo ideal e volumes bons/rejeitados. Logo, o trabalho mede *sinais de risco operacional associados* ao OEE, não o percentual real de OEE.

**Validação:** cinco consultas executadas com o Machine Downtime.csv em SQLite, sem erros; `PRAGMA foreign_key_check` sem violações. A origem de produção do CSV não foi auditada.
