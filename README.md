# TelemetryOS

Dashboard de telemetria industrial com Next.js 15, React, Tailwind CSS/shadcn, OpenUI, Zustand, Axios, PostgreSQL e Prisma ORM 7.10. Ingestão e backend em TypeScript.

## Rodar localmente

```bash
bun install
bunx prisma generate
bun run db:migrate
bun dev
```

Abra `http://localhost:3000`.

## Rodar com Docker

Copie `telemetria_suja.csv` para `data/telemetria_suja.csv` e execute:

```bash
docker compose up --build
```

Configure `DEEPSEEK_API_KEY` e `WEBHOOK_SECRET` (pelo menos 32 caracteres aleatórios) em um arquivo `.env` local ou no ambiente do comando. `.env` é ignorado pelo Git e excluído da imagem Docker; as credenciais ficam no servidor. Para o copiloto:

```bash
DEEPSEEK_API_KEY=sk-... docker compose up --build -d
```

O dashboard fica em `http://localhost:3000`. A inicialização executa as migrações Prisma, reconhecendo a base existente sem apagar suas leituras ou conversas. Para importar a coleta inicial ou uma nova coleta, use a página Fontes de dados ou execute `docker compose --profile tools run --rm ingest`. O importador TypeScript normaliza datas, vírgulas decimais, sentinelas e valores ausentes, remove duplicatas e insere apenas IDs novos; leituras editadas são preservadas. O arquivo precisa ter as nove colunas de `telemetria_suja.csv`. Não há serviço Python.

## Copiloto OpenUI

O chat em `/dashboard/copiloto` usa o Agent Interface do OpenUI para conversas, navegação, histórico, renomeação, exclusão e acompanhamento das ferramentas. A biblioteca OpenUI Lang renderiza os gráficos e tabelas shadcn padronizados, indicadores, botões de continuação e prévias de edição. O composer usa o slot do SDK para acrescentar anexos.

DeepSeek gera com `stream: true`. O servidor lê os eventos SSE do provedor e encaminha os trechos imediatamente pelo protocolo AG-UI; o Renderer recebe `isStreaming` para construir a resposta progressivamente. O botão de interromper cancela a requisição. O parser valida a estrutura ao término da geração.

Funções registradas: `get_fleet_summary`, `query_telemetry`, `aggregate_telemetry`, `inspect_telemetry_schema`, `get_alerts`, `search_uploaded_file` e `propose_telemetry_change`. Consultas de telemetria usam parâmetros validados, transações de leitura, timeout de 5 segundos e até 200 linhas. Buscas aceitam ID da leitura, máquina, período, limites de sensores e ordenação. Alertas usam temperatura >100°C ou vibração >4,5 mm/s. Não há execução de código, comandos do sistema ou SQL livre do modelo.

Conversas e mensagens ficam em `chat_threads` no PostgreSQL. O histórico local anterior é migrado para uma conversa preservada. Anexos CSV, XLSX, PDF com texto, TXT, MD e JSON (até 5 MB, três por mensagem) são extraídos e armazenados em `chat_files`; a IA pode consultar trechos ou pesquisar texto literal com referência às linhas. PDF digitalizado exige OCR prévio. Anexar não importa automaticamente linhas para `telemetry`.

Edições atingem um único campo numérico de uma leitura identificada. A IA prepara uma proposta, e o cartão exibe antes/depois. Só o botão de confirmação grava. `telemetry_changes` guarda a auditoria, a confirmação é idempotente e uma mudança concorrente invalida a proposta. Propostas expiram em 24 horas. IDs de máquina e leitura não são editáveis.

## Comandos, estado e componentes

## Observabilidade e fluxo de dados

`/dashboard/observabilidade` mostra eventos reais das últimas 24 horas, permite filtrar pelo Trace ID e por falhas e fornece um teste de leitura pelo store Zustand. O retorno normal é limitado aos 100 eventos mais recentes; uma consulta por trace retorna até 300 spans. `/api/metrics` exporta contadores e durações no formato Prometheus. Os mesmos spans são emitidos como JSON em stdout, consultáveis com `docker compose logs web`; o log do container tem rotação de 10 MB e três arquivos. Os eventos estruturados ficam na tabela `trace_events`.

O contexto W3C `traceparent` liga componente, Zustand, API, Command Bus, Next Data Cache, Redis e Prisma/PostgreSQL, com retorno ao estado e ao componente. Cada resposta instrumentada inclui `X-Trace-Id` e `traceparent`. A leitura inicial renderizada no servidor também é rastreada, e o botão **Atualizar leituras** percorre explicitamente o store e a API. Requisições do armazenamento de conversas e as confirmações de edição propagam o mesmo contexto. Consultas e chamadas de ferramentas/DeepSeek têm spans próprios.

Não são registrados payloads de comandos, SQL, perguntas, conteúdo de anexos, cookies, tokens ou credenciais. O coletor de eventos do cliente aceita somente nomes/camadas específicos e operações conhecidas, identifica a origem como `client` e elimina spans repetidos pelo par Trace ID / Span ID. Ele não pode publicar spans de banco ou servidor. Uma falha na persistência da observabilidade não reverte um comando já confirmado.

Leitura: `componente → Zustand → API → Next Cache → Redis → Prisma → PostgreSQL`, com retorno pelos mesmos níveis. Uma revisão numérica é consultada no PostgreSQL e participa das chaves dos dois caches. A revisão é incrementada na mesma transação de uma importação ou edição confirmada; após o commit, o bus sinaliza Redis e invalida a tag do Next. Assim, uma indisponibilidade do Redis ou uma falha na invalidação não faz a próxima leitura usar uma revisão antiga. O TTL dos resultados é de 60 segundos. Redis indisponível degrada a leitura para o banco. Conversas, sessões e anexos não são armazenados nesse cache de telemetria.

## Login Google preparado

`/login` usa o cliente Better Auth, com adaptador Prisma, tabelas de usuários/sessões/contas/verificações e handler `/api/auth/[...all]`. O Google fica desativado enquanto `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e um `BETTER_AUTH_SECRET` de pelo menos 32 caracteres não estiverem configurados. `BETTER_AUTH_URL` define a origem, por padrão `http://localhost:3000`; o callback é `/api/auth/callback/google`.

O botão informa a pendência e não simula autenticação. O dashboard continua em modo de demonstração, sem exigir sessão, conforme o login ainda não funcional solicitado. Credenciais Google não foram criadas nem configuradas. Ao configurá-las no ambiente do Docker, a opção de login se torna disponível; a proteção e segregação dos dados por usuário são uma etapa separada.

Referências: https://better-auth.com/docs/integrations/next e https://better-auth.com/docs/authentication/google.

## Execução de comandos

As escritas passam pelo Command Bus em `lib/application/command-bus.ts`: cada comando tem tipo, payload e chave de idempotência. `command_receipts` persiste o resultado, e um advisory lock dentro da transação Prisma garante execução única mesmo com requisições concorrentes. Reutilizar uma chave com outro payload retorna conflito. A mensagem do chat também identifica a execução em `chat_runs`: duplicatas em andamento são bloqueadas e respostas concluídas são reutilizadas sem chamar novamente o provedor.

O Zustand em `lib/stores/command-store.ts` aplica a edição otimista, mantém a identidade da requisição ao repetir, impede envio duplo no cliente e reverte o estado se o servidor falhar. O SDK OpenUI mantém as conversas em seu store Zustand. A chave `Idempotency-Key` também é enviada pelo adaptador de armazenamento das conversas.

Atomic Design: `components/atoms` expõe os componentes shadcn; `molecules` reúne anexos e prévias de valores; `organisms` contém composer, análise e importação; `templates/copilot-workspace.tsx` compõe o Agent Interface. Os arquivos públicos anteriores reexportam os componentes para preservar os imports. Gráficos e tabelas fornecidos continuam sendo os blocos shadcn originais.

O schema e as migrações ficam em `prisma/`. CRUD usa modelos Prisma; agregações analíticas e controle transacional usam SQL parametrizado pelo próprio Prisma. A migração inicial é marcada como baseline quando já há telemetria, e não usa reset ou `db push`.

O provedor recebe perguntas, as últimas 18 mensagens de contexto e resultados das funções executadas, incluindo trechos de anexos consultados. `DEEPSEEK_MODEL` é opcional; padrão `deepseek-flash`. A chave fica somente no servidor. A integração usa o SDK aberto do OpenUI e chamadas diretas ao DeepSeek, sem chave do Gateway OpenUI.

Os testes verificam filtros, Prisma/banco real, conversas independentes, confirmação/conflito de edições, streaming de servidor e cliente, concorrência/idempotência, reenvio de mensagens, normalização/importação, estado otimista com rollback, propagação/redação de traces, Redis real, contrato OpenAPI, HMAC, lote atômico e Google inativo sem credenciais. O provedor é simulado nos testes automatizados; fixtures de leitura são removidas ao término. Os arquivos de teste executam sequencialmente porque compartilham a base local. Execute com o worker parado para evitar processamento das fixtures de fila:

```bash
docker compose stop worker
docker compose exec web npm run test:agent
docker compose start worker
```

Referências: https://www.openui.com/docs/agent/getting-started/introduction e https://api-docs.deepseek.com/guides/tool_calls/

## Organização

- `app/`: páginas, APIs e Swagger em `/docs`
- `components/standard-telemetry-view.tsx`: dashboard com dados reais e blocos shadcn fornecidos
- `components/templates/copilot-workspace.tsx`: conversas OpenUI e streaming
- `scripts/ingest.ts`: carga e limpeza do CSV com Prisma
- `lib/application/`: comandos e idempotência
- `prisma/`: schema e migrações PostgreSQL
- `lib/jobs/`: fila, outbox transacional e recuperação de jobs
- `lib/openapi.ts`: contrato de todas as rotas HTTP da aplicação
- `scripts/worker.ts` e `scripts/realtime.ts`: processos independentes
- `docker-compose.yml`: web, PostgreSQL, Redis, worker e WebSocket

## Swagger e integrações

Abra `http://localhost:3000/docs`; o contrato JSON está em `/api/openapi`. O Swagger é servido com seus assets locais e não envia o schema a um validador externo. O teste de contrato valida o documento e verifica que todos os métodos exportados pelas rotas `app/api` estão documentados. Inclui uploads multipart, SSE/NDJSON, schemas, limites, conflitos, idempotência, webhook e autenticação pendente. `x-websocket` documenta o protocolo de eventos; WebSocket não é uma rota HTTP de CRUD.

`POST /api/webhooks/telemetry` recebe até 500 leituras e 512 KiB por lote, com os campos `id`, `machineId`, `timestamp` UTC e sensores `temperature`, `oilPressure`, `rpm`, `vibration`, `consumption`, `engineHours` (número ou null). `eventId` identifica a entrega. Para IDs existentes, envie `expectedVersion`; para IDs novos a versão inicial é zero. Um conflito desfaz o lote inteiro.

Cabeçalhos obrigatórios: `X-Webhook-Timestamp` (segundos Unix, tolerância de cinco minutos) e `X-Webhook-Signature: sha256=<hex>`. Calcule HMAC-SHA256 dos bytes de `timestamp + '.' + corpo JSON exato`, usando `WEBHOOK_SECRET`. Não envie o segredo ao navegador. Reformatar o JSON depois de assiná-lo invalida a assinatura. O corpo é lido com limite antes de ser processado. Esta integração recebe webhooks; não cadastra nem entrega webhooks de saída para terceiros.

`GET /api/telemetry/records/{id}` retorna a leitura, `version` e `ETag`. `PATCH` recebe `{expectedVersion, field, value, reason}`; os nomes de `field` são os nomes dos sensores no CSV. A gravação incrementa a versão, registra antes/depois e retorna 409 quando outra pessoa já alterou o registro. Recarregue e revise antes de tentar novamente. Propostas do chat também guardam a versão da prévia e não sobrescrevem uma atualização posterior de outro sensor da mesma leitura.

## Worker, fila e eventos

Arquivos acima de 64 KiB ou enviados com `POST /api/import?async=true` retornam 202 e `Location: /api/jobs/{id}`. O arquivo e o evento de submissão são gravados juntos no PostgreSQL. O worker publica a outbox, processa BullMQ com concorrência 2 e faz até cinco tentativas com backoff exponencial; CSV sem leituras válidas termina em falha sem repetir inutilmente. `/dashboard/jobs` mostra estado, resultado, contagens, tentativas e reenvio de falhas. `/api/jobs/health` consulta a fila e eventos pendentes; `/api/metrics` também expõe estados dos jobs e tamanho da outbox.

Outbox usa leases de 60 segundos e `FOR UPDATE SKIP LOCKED`, permitindo múltiplos workers. Falhas de publicação são repetidas após cinco segundos. A cada 30 segundos o worker reconcilia jobs antigos que perderam sua entrada no Redis; a gravação de leituras continua idempotente mesmo quando uma entrega é repetida. Redis usa AOF e política `noeviction`. Retenção do BullMQ: até 1.000 concluídos por 24 horas e até 1.000 falhos por sete dias; metadados, arquivo e resultado duráveis permanecem no PostgreSQL. Para ampliar o processamento, `docker compose up -d --scale worker=2`.

`/api/realtime/config` retorna o endereço WebSocket, por padrão `ws://localhost:3002`. O gateway é um processo separado do Next, usa Redis pub/sub, verifica a origem, envia heartbeat a cada 30 segundos e desconecta clientes lentos. `REALTIME_PUBLIC_URL` permite configurar uma URL WSS de um proxy; `REALTIME_ALLOWED_ORIGINS` aceita origens adicionais separadas por vírgula. O proxy deve encaminhar upgrade WebSocket.

Eventos `telemetry.changed`, `job.submit`, `job.completed` e `job.failed` carregam somente metadados de atualização, revisão e correlação. Os clientes deduplicam pelo ID, atualizam o Zustand e recarregam a visão ao reconectar. Uma resposta HTTP antiga não repõe dados que um evento remoto já invalidou. Tabela, gráfico e indicadores são consultados na mesma transação `REPEATABLE READ`. Pub/sub não conserva eventos para clientes desconectados: a API e o PostgreSQL são a fonte de verdade. SSE continua sendo o transporte da resposta da IA.

Os logs correlacionam o comando de origem, o worker, Redis, transmissão WebSocket, commit do Zustand e renderização. Web e processos possuem healthchecks e rotação de logs. Use `docker compose logs -f web worker realtime` para acompanhar. O login Google permanece pendente e os dados são compartilhados em modo de demonstração, sem separação por usuário.
