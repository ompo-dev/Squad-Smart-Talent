# Evidências da entrega — issue #11

Preencha esta tabela antes do envio. Cada contribuição deve ter um commit semântico, um PR direcionado a `dev` e uma revisão útil feita por outra pessoa.

| Integrante | Contribuição própria | Commit semântico | PR para `dev` | Revisor | Link do comentário útil |
| --- | --- | --- | --- | --- | --- |
| _preencher_ | _preencher_ | _hash e título_ | _URL do PR_ | _nome_ | _URL do comentário_ |
| _preencher_ | _preencher_ | _hash e título_ | _URL do PR_ | _nome_ | _URL do comentário_ |
| _preencher_ | _preencher_ | _hash e título_ | _URL do PR_ | _nome_ | _URL do comentário_ |

## Evidências automatizadas

Para cada execução válida da CI, registre o link da execução e confirme os artefatos:

- `test-reports-<run_id>`: relatório de testes e `reports/pandas/` gerado pela fixture;
- `pandas-container-results-<run_id>`: os mesmos resultados produzidos pela imagem `python/Dockerfile`;
- `container-logs-<run_id>`: diagnóstico da integração da aplicação.

## Checklist de revisão

- [ ] PR aberto contra `dev`, com título e branch seguindo as convenções.
- [ ] CI verde, incluindo **Types, tests, Python pipeline and build** e **Pandas pipeline container**.
- [ ] O revisor deixou um comentário técnico útil e o autor respondeu ou aplicou a correção.
- [ ] O PR e o comentário foram incluídos na tabela acima.
