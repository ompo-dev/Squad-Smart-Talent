# GRUPO 4 — ENTREGA FINAL | MANUFATURA E EFICIÊNCIA (OEE)

**Smart Talent John Deere · Remoto 01 · Aula 1 · Prazo: 30/10/2026 às 23h59**

## O que vale para entregar

**Esta é a versão definitiva consolidada, baseada no dataset Machine Downtime.** Tudo está diretamente dentro desta única pasta.

**No portal, a exigência central é**:
1. `02_cinco_consultas_SQLite.sql` — cinco perguntas, cinco consultas (WHERE/ORDER BY, GROUP BY, JOIN, HAVING e consulta livre) e uma interpretação em cada bloco; SQL sem `SELECT *`.
2. `modelo_relacional.png` (ou `modelo_relacional.pdf`) — desenho do banco com PKs, FKs e relações.
3. `preparacao_sabado2.md` — checklist da parte 3: GitHub/2FA, Docker, EADs e tarefas do board. Os itens pessoais ainda dependem de confirmação.

**Como complementos para entregar ou apresentar**, inclua `Relatorio_Grupo4_OEE.pdf` (relatório com contexto, consultas, modelo e limites) e `TEXTO_DE_ENTREGA.md` (texto pronto para colar no portal).

## Arquivos nesta única pasta

| Arquivo | Finalidade |
|---|---|
| `Relatorio_Grupo4_OEE.pdf` | Relatório completo, contextualização, cinco perguntas, modelo, limites e resultados |
| `02_cinco_consultas_SQLite.sql` | As cinco consultas exigidas, com suas perguntas e interpretações |
| `modelo_relacional.png` | Imagem do modelo para o portal |
| `modelo_relacional.pdf` | Alternativa do modelo em PDF |
| `TEXTO_DE_ENTREGA.md` | Resposta textual para a plataforma |
| `preparacao_sabado2.md` | Checklist das verificações pessoais e tarefas reais do board |
| `machine_downtime.csv` | **Dataset real recebido**, preservado integralmente |
| `grupo4_machine_downtime.db` | SQLite já preparado e validado (abre diretamente no DB Browser) |
| `01_modelo_sqlite.sql` | DDL das tabelas e chaves do modelo |
| `03_desafio_dimensao_distinct.sql` | `SELECT DISTINCT` + JOIN (desafio adicional) |
| `04_resultados_com_csv_real.md` | Números e interpretação de cada pergunta, com ressalvas |
| `resultado_consulta_1.csv` a `resultado_consulta_5.csv` | Tabelas de saída das cinco consultas executadas |
| `05_resumo_validacao.json` | Contagens e SHA-256 do CSV original |
| `preparar_banco.py` | Script opcional para gerar um novo banco SQLite a partir do CSV (Python padrão) |
| `executar_consultas.py` | Script opcional para executar as consultas e exportar os resultados |

## Resultados efetivamente calculados

| Indicador | Resultado |
|---|---|
| CSV bruto | 2.500 registros |
| Registros da tabela limpa | 2.500 |
| Células corrigidas | 154 (vazios, zeros, negativos ou fora da faixa) |
| Máquinas distintas | 3 |
| Linhas de montagem | 3 (Shopfloor-L1/L2/L3) |
| Ocorrências críticas | 1.283 |
| Consulta 1 | Leitura de 30/03/2022 da Makino-L1 com 2 critérios simultâneos |
| Consulta 2 | Shopfloor-L1: 874 leituras e 51,95% de paradas |
| Consulta 3 | Makino-L1: 458 ocorrências; Makino-L3: 422; Makino-L2: 403 |
| Consulta 4 | Makino-L1 (51,95%) e Makino-L3 (50,73%) acima da média de 50,6% |
| Consulta 5 | Makino-L1 e Makino-L2 com 3/4 pontos; tendência piorando nas três |
| Verificação de FKs | Nenhuma violação |

### Limites da análise

O CSV **não mede o OEE numérico**: faltam duração de paradas, produção ideal/real e peças boas/rejeitadas. As consultas ajudam a investigar possíveis fontes de perdas, não a calcular Disponibilidade × Desempenho × Qualidade.

Os limites de sensor são **critérios ilustrativos de triagem**, não referências técnicas homologadas. O campo `perda_leitura` significa amostra recebida com valores essenciais ausentes/inválidos, não perda de comunicação. Não declarar parada automática de máquinas.

## Abrir e testar no DB Browser for SQLite

1. Abra `grupo4_machine_downtime.db` no DB Browser for SQLite.
2. Em **Executar SQL**, abra `02_cinco_consultas_SQLite.sql` e execute cada consulta separadamente. `COUNT(*)` é válido: o enunciado proíbe `SELECT *`, não a função de contagem.
3. Confira os valores de `resultado_consulta_1.csv` até `resultado_consulta_5.csv`.
4. Para demonstrar `SELECT DISTINCT` e JOIN, use `03_desafio_dimensao_distinct.sql`.

Se quiser recriar tudo **sem instalar bibliotecas Python adicionais**, abra um terminal nesta pasta e execute:

```bash
python scripts/preparar_banco.py ../data/machine_downtime.csv dados/grupo4_machine_downtime.db
python scripts/executar_consultas.py
```

## Parte 3 — não marcar concluído sem evidência

Foi preparado `preparacao_sabado2.md` com os cartões [S2] vistos no board, critérios de aceite e espaços para responsáveis. **A autenticação 2FA, os EADs, a execução do Docker e a atribuição nominal de responsáveis não foram verificados.**

## Resumo da decisão

**Se você só enviar o que o enunciado exige:** SQL do exercício, modelo PNG e checklist do Sábado 2. **Se puder entregar um ZIP:** este pacote já reúne as partes 1, 2 e a documentação da parte 3, com banco SQLite e CSV originais para conferência.
