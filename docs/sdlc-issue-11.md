# Plano SDLC — integração do pipeline Python à CI (issue #11)

## 1. Planejamento

- **Objetivo:** comprovar que o pipeline Pandas produz resultados reprodutíveis e compatíveis, nos casos conhecidos, com o tratamento TypeScript da aplicação.
- **Escopo:** testes Python, fixture controlada, execução do pipeline, validação dos quatro arquivos gerados, imagem Docker, artefatos da CI, higiene de arquivos gerados e evidências de PR/revisão.
- **Fora do escopo:** reescrever a aplicação, adicionar cache/fila, ou declarar equivalência para qualquer CSV possível.
- **Dependências:** pipeline Python, parser TypeScript e workflow base já existentes; os links de PR e comentários dependem da atuação do time no GitHub.

## 2. Requisitos e critérios de aceite

| Critério | Evidência |
| --- | --- |
| Casos conhecidos são tratados | `tests/fixtures/pipeline-known-cases.csv` e `npm run test:python` |
| Pandas e aplicação concordam na fixture | `tests/pandas-equivalence.test.ts` |
| Execução gera saídas válidas | `npm run pipeline:run` e `npm run verify:pandas-output` |
| Chaves determinísticas conferem | `npm run validate:pandas-keys -- reports/pandas/telemetry_clean.csv` |
| Container é validado | job **Pandas pipeline container** |
| Artefatos podem ser consultados | artefatos `test-reports-*` e `pandas-container-results-*` |
| Banco/ambiente local não é versionado | `.gitignore`, remoção do SQLite do índice e instruções de recriação |

## 3. Desenho da solução

```text
fixture CSV
  ├─ Python/Pandas ──> CSV limpo + 2 resumos + relatório JSON
  └─ parser TypeScript ─┐
                         ├─ teste de equivalência na fixture
validador Node <─────────┘  └─ confere record_key

CI
  ├─ quality: instala Python, testa, executa e publica resultados
  └─ pipeline-container: constrói a imagem Python, executa a fixture e publica resultados
```

## 4. Implementação

1. Manter o código do pipeline em `python/pipeline.py` e suas dependências em `requirements.txt`.
2. Executar testes Python isolados com `npm run test:python`.
3. Rodar a fixture com `npm run pipeline:run` e verificar os arquivos com `npm run verify:pandas-output`.
4. Comparar a fixture com o parser TypeScript em `tests/pandas-equivalence.test.ts`.
5. Executar o mesmo contrato na imagem `python/Dockerfile`.
6. Ignorar ambientes virtuais, relatórios e bancos gerados; regenerar o SQLite local pelos scripts documentados.

## 5. Verificação e revisão

- Rode os comandos do README em uma cópia limpa.
- Abra um PR da branch `ci/11-integrar-pipeline-ci` para `dev`.
- Solicite revisão de outra pessoa; o comentário deve apontar uma decisão, risco ou melhoria verificável.
- Registre a contribuição e os links em [evidencias-entrega.md](evidencias-entrega.md).

## 6. Entrega e acompanhamento

- Só marque o card como **Em revisão** com PR aberto.
- Só marque como **Feito** quando os jobs estiverem verdes, a revisão estiver concluída e a tabela de evidências tiver os links reais.
- Antes do merge, confirme que `npm run typecheck` regenerou os tipos de rota do Next e passou; a CI executa esse mesmo comando, sem ocultar erros com `any`, casts ou desativação de checks.
