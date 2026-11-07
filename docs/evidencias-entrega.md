# Evidências da entrega - issue #11

Cada contribuição deve ter um commit semântico, um PR direcionado a `dev` e uma revisão útil feita por outra pessoa.

## Entregas mergeadas

| Task | Card | Commit | PR | Estado |
| --- | --- | --- | --- | --- |
| 1 | `[S2] Adaptar a limpeza existente para um pipeline Pandas reproduzível` | `1ff4aa7` | [#19](https://github.com/ompo-dev/Squad-Smart-Talent/pull/19) | mergeado em `homolog` |
| 2 | `[S2] Gerar gráficos conclusivos e ampliar os relatórios de manutenção` | `f5cac86` | [#20](https://github.com/ompo-dev/Squad-Smart-Talent/pull/20) → [#22](https://github.com/ompo-dev/Squad-Smart-Talent/pull/22) | mergeado em `dev` e promovido a `homolog` |
| 3 | `[S2] Permitir investigar e exportar problemas de qualidade das leituras` | `d5cefba` | [#25](https://github.com/ompo-dev/Squad-Smart-Talent/pull/25) | mergeado em `homolog` |
| 4 | `[S2] Acrescentar execução Docker do pipeline Pandas por volumes` | `03f3075` | [#21](https://github.com/ompo-dev/Squad-Smart-Talent/pull/21) → [#23](https://github.com/ompo-dev/Squad-Smart-Talent/pull/23) | mergeado em `dev` e promovido a `homolog` |
| 5 | `[S2] Estender a CI para validar a entrega Python e consolidar evidências` | `a084e9e` | [#21](https://github.com/ompo-dev/Squad-Smart-Talent/pull/21) | mergeado em `dev` |

A Task 3 foi tratada na issue #24 e integrada pela PR #25.

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

Os links abaixo foram conferidos no GitHub em 07/11/2026. Uma célula marcada como **pendente** não é uma afirmação de que o critério foi cumprido: é exatamente a pendência que o time precisa resolver antes de apresentar a comprovação como completa.

| Integrante | Contribuição própria | Commit | PR | Revisor | Comentário útil / situação |
| --- | --- | --- | --- | --- | --- |
| Gabriel Marques (`gabriel8845`) | Pipeline Pandas de limpeza | `1ff4aa7` — `Add telemetry cleaning pipeline using Pandas` | [#19](https://github.com/ompo-dev/Squad-Smart-Talent/pull/19) | Maicon (`ompo-dev`) | [Revisão com bloqueadores e critérios de correção](https://github.com/ompo-dev/Squad-Smart-Talent/pull/19#issuecomment-6695405480). **Pendente:** o título do commit não segue Conventional Commits. |
| Fernando (`vecchifefe-byte`) | Gráficos conclusivos e relatório de manutenção | `f5cac86` — `feat(relatorios): adicionar graficos conclusivos de triagem` | [#20](https://github.com/ompo-dev/Squad-Smart-Talent/pull/20) | Maicon (`ompo-dev`) | [Revisão sobre integração com o pipeline e critérios dos gráficos](https://github.com/ompo-dev/Squad-Smart-Talent/pull/20#issuecomment-6700848703). |
| Lorenzo (`Wolsadek`) | CI, testes de equivalência, artefatos, imagem Docker e higiene do repositório | `a084e9e` — `ci(pipeline): validar entrega Python na automação` | [#21](https://github.com/ompo-dev/Squad-Smart-Talent/pull/21) | Maicon (`ompo-dev`) | [Revisão sobre padronização de caminho, Compose e evidências](https://github.com/ompo-dev/Squad-Smart-Talent/pull/21#issuecomment-6700874532). Ajustes integrados em [#23](https://github.com/ompo-dev/Squad-Smart-Talent/pull/23). |
| Maicon (`ompo-dev`) | Qualidade das leituras, correções de integração e promoções | `d5cefba` — `feat(telemetry): filtrar e exportar problemas de qualidade das leituras` | [#25](https://github.com/ompo-dev/Squad-Smart-Talent/pull/25) | **Pendente** | Não foi localizado comentário de revisão por outro integrante na PR #25. |
| `Dudusar-dev` | **Pendente** | **Pendente** | **Pendente** | **Pendente** | Não foi localizado commit nem PR dessa conta neste repositório. A pessoa precisa fazer uma contribuição própria, abrir uma PR e receber revisão cruzada. |

## Pendências para a comprovação integral

- [ ] `Dudusar-dev` entregar uma contribuição própria com commit semântico, PR e revisão de outro integrante.
- [ ] Registrar uma revisão útil de outro integrante na PR [#25](https://github.com/ompo-dev/Squad-Smart-Talent/pull/25), ou substituir essa entrada por uma PR do Maicon que tenha essa evidência.
- [ ] Corrigir a exceção do commit de Gabriel: criar uma contribuição complementar com commit semântico ou documentar formalmente a justificativa aceita pelo professor.
- [ ] Após resolver os três itens, atualizar esta tabela e reabrir/encerrar a issue #11 com os links finais.

## Checklist de revisão

- [x] As PRs #19, #20 e #21 têm contribuição identificada e comentário técnico útil registrado.
- [x] A CI valida types, testes, pipeline Python, saída e container.
- [x] As PRs e comentários localizados foram incluídos na tabela acima.
- [ ] Todas as contas do time têm contribuição própria, PR e revisão cruzada comprovadas.
