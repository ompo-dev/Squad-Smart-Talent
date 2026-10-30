# Grupo 4 — Manufatura e Eficiência (OEE)
**Smart Talent John Deere — Remoto 01 — Aula 1 — 30/10/2026**

## Parte 1 — Cinco perguntas, SQL e interpretação

O arquivo **`02_cinco_consultas_SQLite.sql`** contém as cinco perguntas de negócio, as consultas no dialeto **SQLite 3** e **uma frase de interpretação por consulta**:

1. **Filtro e ordenação:** quais são as dez leituras com ocorrências mais graves? A triagem considera número de alertas simultâneos, temperatura, vibração e pressão de óleo. **Interpretação:** as primeiras linhas concentram mais alertas simultâneos e condições de sensor que merecem análise prioritária.
2. **Agregação e GROUP BY:** qual turno concentra mais alertas e leituras incompletas? **Interpretação:** os turnos no topo apresentam mais ocorrências por 100 leituras, permitindo comparações mesmo com volumes diferentes.
3. **JOIN:** quais máquinas e faixas de uso concentram cada tipo de ocorrência? **Interpretação:** o cruzamento identifica as máquinas e as faixas de uso com maior concentração de alertas, incluindo máquinas sem ocorrência.
4. **HAVING/subconsulta:** quais máquinas registraram mais alertas por leitura do que a média da frota? **Interpretação:** as máquinas apresentadas possuem frequência de alertas por leitura superior à média ponderada das leituras de toda a frota.
5. **Consulta livre — gestor:** quais máquinas devem ser priorizadas para inspeção e sua condição está piorando ou melhorando? **Interpretação:** o ranking usa quatro critérios de risco e compara a frequência de alertas entre as semanas de 01–07/05 e 08–14/05/2026.

As consultas foram **executadas no CSV fornecido pelo grupo**, com 4.060 linhas de origem, 60 duplicatas idênticas removidas, 4.000 leituras limpas, 24 máquinas e 298 ocorrências. **Resultados:** leitura mais crítica 4238 (máquina 7); turno A com 0,96 alerta de sensor por 100 leituras; máquinas 5 e 21 empatadas com 18 ocorrências; máquina 5 com 3,35 alertas por 100 leituras, superior à média de 0,68; máquina 22 em primeiro no ranking de manutenção (4/4 critérios, tendência piorando). Consulte `04_resultados_com_csv_real.md` e os cinco CSVs de saída para números e ressalvas completos.

## Parte 2 — Modelo de dados

Arquivos: **`modelo_relacional.png`** (imagem), **`modelo_relacional.pdf`** (alta qualidade), **`01_modelo_sqlite.sql`** (DDL), **`03_desafio_dimensao_distinct.sql`** (desafio opcional).

Entidades e relacionamentos:

- **`telemetria_suja`:** contém o CSV bruto com os valores originais, preservando registros problemáticos.
- **`dim_maquina`:** uma linha por máquina, com `id_maquina` como chave primária.
- **`telemetria_limpa`:** uma linha por leitura, com `id_leitura` como chave primária e `id_maquina` como chave estrangeira. Uma máquina tem muitas leituras (1:N).
- **`fato_ocorrencia`:** uma linha por tipo de alerta, com `id_ocorrencia` como chave primária, `id_leitura` e `id_maquina` como chaves estrangeiras. Uma leitura pode ter zero, uma ou várias ocorrências (1:0..N).

A chave primária própria de ocorrências corrige a ambiguidade do esboço inicial, em que várias ocorrências podiam compartilhar a mesma leitura.

## Parte 3 — Preparação do Sábado 2

A verificação de conta GitHub com 2FA, Docker Desktop + `docker run hello-world`, conclusão dos dois EADs e atualização do board depende de comprovação por cada integrante. **Nenhum item está sendo declarado concluído sem confirmação.** O arquivo `preparacao_sabado2.md`, nesta mesma pasta, contém o checklist e as tarefas do board com campo para responsáveis.

## Limitações e hipóteses

Temperatura >= 100 °C, pressão de óleo < 20 psi e vibração > 4,5 mm/s são parâmetros **ilustrativos de triagem**, não limites garantidos pelo fabricante. A variável `perda_leitura` assinala campos essenciais ausentes ou inválidos **na linha recebida**, não ausência de amostras no transporte. As faixas de uso e a dedução do turno quando ele não está no CSV são hipóteses a confirmar.

**OEE = Disponibilidade × Desempenho × Qualidade**, mas o conjunto informado não possui durações de paradas, tempo de produção planejado, ciclo ideal e volumes bons/rejeitados. Logo, o trabalho mede *sinais de risco operacional associados* ao OEE, não o percentual real de OEE.

**Validação:** cinco consultas executadas com o CSV enviado pelo grupo, em SQLite, sem erros; `PRAGMA foreign_key_check` sem violações. A origem de produção do CSV não foi auditada. O pacote final contém somente o CSV real e seu banco SQLite; os testes fictícios foram excluídos.
