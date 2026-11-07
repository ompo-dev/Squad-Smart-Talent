# Evidências da entrega - issue #11

Cada contribuição deve ter um commit semântico, um PR direcionado a `dev` e uma revisão útil feita por outra pessoa.

## Entregas mergeadas

| Task | Card | Commit | PR | Estado |
| --- | --- | --- | --- | --- |
| 1 | `[S2] Adaptar a limpeza existente para um pipeline Pandas reproduzível` | `c7bf7eb` | #19 | mergeado em `homolog` |
| 2 | `[S2] Gerar gráficos conclusivos e ampliar os relatórios de manutenção` | `50e3c1c` | #22 | mergeado em `homolog` |
| 3 | `[S2] Permitir investigar e exportar problemas de qualidade das leituras` | _preencher no PR_ | _a abrir_ | nesta branch |
| 4 | `[S2] Acrescentar execução Docker do pipeline Pandas por volumes` | `7a0f547` | #23 | mergeado em `homolog` |
| 5 | `[S2] Estender a CI para validar a entrega Python e consolidar evidências` | `7a0f547` | #23 | mergeado em `homolog` |

A Task 3 está na issue #24 e na branch `feat/24-qualidade-leituras`, aberta a partir de `dev`.

## Verificação local

Execução de 07/11/2026 sobre `homolog` @ `7a0f547`, com a correção de isolamento dos testes de gráficos:

| Comando | Resultado |
| --- | --- |
| `npm run test:python` | 30 testes OK, 1 skip (`grupo4_machine_downtime.db` removido na Task 5) |
| `npm run pipeline:run` | fixture processada; CSV limpo, 2 resumos, `quality_report.json`, 2 PNGs e 2 CSVs gerados |
| `npm run verify:pandas-output` | `{"rows":3,"status":"valid"}` (fixture) |
| `npm run validate:pandas-keys -- reports/pandas/telemetry_clean.csv` | 3 chaves, 0 divergências (fixture) |
| `python src/pipeline.py --input data/machine_downtime.csv --output reports/pandas` | 2.500 leituras, 154 células corrigidas |
| `npm run validate:pandas-keys` na base real | 2.500 chaves, 0 divergências |
| `npm run typecheck` | route types e `tsc` sem erros |
| `npm run test:pipeline` | 4/4 |

A base real mantém `Shopfloor-L1` com 51,95% de paradas (454 de 874 leituras), igual ao título calculado da Task 2 e à consulta 2.

## Evidências automatizadas

Para cada execução válida da CI, registre o link da execução e confirme os artefatos:

- `test-reports-<run_id>`: relatório de testes e `reports/pandas/` gerado pela fixture;
- `pandas-container-results-<run_id>`: os mesmos resultados produzidos pela imagem `python/Dockerfile`;
- `container-logs-<run_id>`: diagnóstico da integração da aplicação.

## Contribuições por integrante

| Integrante | Contribuição própria | Commit semântico | PR para `dev` | Revisor | Link do comentário útil |
| --- | --- | --- | --- | --- | --- |
| _preencher_ | _preencher_ | _hash e título_ | _URL do PR_ | _nome_ | _URL do comentário_ |
| _preencher_ | _preencher_ | _hash e título_ | _URL do PR_ | _nome_ | _URL do comentário_ |
| _preencher_ | _preencher_ | _hash e título_ | _URL do PR_ | _nome_ | _URL do comentário_ |

## Checklist de revisão

- [ ] PR aberto contra `dev`, com título e branch seguindo as convenções.
- [ ] CI verde, incluindo **Types, tests, Python pipeline and build** e **Pandas pipeline container**.
- [ ] O revisor deixou um comentário técnico útil e o autor respondeu ou aplicou a correção.
- [ ] O PR e o comentário foram incluídos na tabela acima.
