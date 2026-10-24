# TelemetryOS

Dashboard de telemetria industrial com Next.js 15, React, Tailwind CSS, Recharts, Zustand, Axios, PostgreSQL e pipeline de ingestão Python.

## Rodar localmente

```bash
bun install
bun dev
```

Abra `http://localhost:3000`.

## Rodar com Docker

Copie `telemetria_suja.csv` para `data/telemetria_suja.csv` e execute:

```bash
docker compose up --build
```

Para habilitar o copiloto DeepSeek, defina `DEEPSEEK_API_KEY` no ambiente do comando (a chave não fica salva no repositório):

```bash
DEEPSEEK_API_KEY=sk-... docker compose up --build -d
```

O dashboard fica em `http://localhost:3000`. O serviço `ingest` normaliza datas, vírgulas decimais, `-999`, remove duplicatas por `id_leitura` e grava a tabela `telemetry` no PostgreSQL.

## Copiloto OpenUI

O chat em `/dashboard/copiloto` usa o Agent Interface do OpenUI para conversas, navegação, histórico, renomeação, exclusão e acompanhamento das ferramentas. A biblioteca OpenUI Lang renderiza os gráficos e tabelas shadcn padronizados, indicadores, botões de continuação e prévias de edição. O composer usa o slot do SDK para acrescentar anexos.

DeepSeek gera com `stream: true`. O servidor lê os eventos SSE do provedor e encaminha os trechos imediatamente pelo protocolo AG-UI; o Renderer recebe `isStreaming` para construir a resposta progressivamente. O botão de interromper cancela a requisição. O parser valida a estrutura ao término da geração.

Funções registradas: `get_fleet_summary`, `query_telemetry`, `aggregate_telemetry`, `inspect_telemetry_schema`, `get_alerts`, `search_uploaded_file` e `propose_telemetry_change`. Consultas de telemetria usam parâmetros validados, transações de leitura, timeout de 5 segundos e até 200 linhas. Buscas aceitam ID da leitura, máquina, período, limites de sensores e ordenação. Alertas usam temperatura >100°C ou vibração >4,5 mm/s. Não há execução de código, comandos do sistema ou SQL livre do modelo.

Conversas e mensagens ficam em `chat_threads` no PostgreSQL. O histórico local anterior é migrado para uma conversa preservada. Anexos CSV, XLSX, PDF com texto, TXT, MD e JSON (até 5 MB, três por mensagem) são extraídos e armazenados em `chat_files`; a IA pode consultar trechos ou pesquisar texto literal com referência às linhas. PDF digitalizado exige OCR prévio. Anexar não importa automaticamente linhas para `telemetry`.

Edições atingem um único campo numérico de uma leitura identificada. A IA prepara uma proposta, e o cartão exibe antes/depois. Só o botão de confirmação grava. `telemetry_changes` guarda a auditoria, a confirmação é idempotente e uma mudança concorrente invalida a proposta. Propostas expiram em 24 horas. IDs de máquina e leitura não são editáveis.

O provedor recebe perguntas, as últimas 18 mensagens de contexto e resultados das funções executadas, incluindo trechos de anexos consultados. `DEEPSEEK_MODEL` é opcional; padrão `deepseek-flash`. A chave fica somente no servidor. A integração usa o SDK aberto do OpenUI e chamadas diretas ao DeepSeek, sem chave do Gateway OpenUI.

Teste funções, isolamento das conversas, confirmação/conflito de edições e chegada do primeiro trecho antes do fim da geração (provedor simulado, banco real; edições de teste usam um registro temporário isolado):

```bash
docker compose exec web npm run test:agent
```

Referências: https://www.openui.com/docs/agent/getting-started/introduction e https://api-docs.deepseek.com/guides/tool_calls/

## Organização

- `app/`: página, estilos globais e API `/api/dashboard`
- `components/dashboard.tsx`: dashboard responsivo e interativo
- `lib/mock.ts`: dados de demonstração para a UI
- `python/ingest.py`: carga e limpeza do CSV
- `docker-compose.yml`: web, PostgreSQL e ingestão
