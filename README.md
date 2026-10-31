# TelemetryOS

**Entenda a condição de uma frota industrial, investigue leituras e converse com os dados.**

O TelemetryOS transforma dados de sensores em um painel de operação. Você recebe leituras de máquinas por arquivos e integrações, acompanha temperatura, vibração e outros indicadores, identifica valores fora dos limites e usa um copiloto de IA para investigar a base e analisar anexos em linguagem natural.

Este é o repositório do projeto **Squad Smart Talent**. A aplicação web, a API, o importador e os processos de apoio são escritos em TypeScript.

> **Estado atual:** modo de demonstração, com dados compartilhados e dashboard acessível sem sessão. O login Google depende de credenciais; configurá-lo ainda não implementa autorização nem separação de dados por usuário. Os alertas seguem regras fixas de triagem.

## Índice

- [O que o sistema faz](#o-que-o-sistema-faz)
- [Início rápido com Docker](#início-rápido-com-docker)
- [Primeiro uso](#primeiro-uso)
- [Desenvolvimento local](#desenvolvimento-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Formato e importação dos dados](#formato-e-importação-dos-dados)
- [Como funciona o copiloto](#como-funciona-o-copiloto)
- [Arquitetura e fluxo de dados](#arquitetura-e-fluxo-de-dados)
- [Padrões de desenvolvimento](#padrões-de-desenvolvimento)
- [Fluxo de contribuição](#fluxo-de-contribuição)
- [Organização do repositório](#organização-do-repositório)
- [API e integrações](#api-e-integrações)
- [Observabilidade](#observabilidade)
- [Testes e validação](#testes-e-validação)
- [CI/CD: desenvolvimento e produção](#cicd-desenvolvimento-e-produção)
- [Operação e solução de problemas](#operação-e-solução-de-problemas)
- [Limites atuais](#limites-atuais)

## O que o sistema faz

**Telemetria** é o registro de medições de um equipamento ao longo do tempo. Cada leitura pertence a uma máquina e reúne data, hora e seis sensores: temperatura do motor, pressão do óleo, rotação, vibração, consumo e horas de funcionamento.

| Recurso | O que você consegue fazer |
| --- | --- |
| Visão geral e frota | Consultar a última leitura de cada máquina, indicadores e gráficos. |
| Alertas | Localizar leituras com temperatura acima de **100 °C** ou vibração acima de **4,5 mm/s**. |
| Relatórios | Visualizar a série diária e até 200 leituras recentes. |
| Fontes de dados | Importar CSVs, consultar recebimentos por arquivo/webhook e acompanhar o estado real da atualização dos painéis. A conexão com APIs externas depende de um conector para a fonte escolhida. |
| Copiloto IA | Fazer perguntas, arrastar arquivos para análise e apresentar tabelas, indicadores e gráficos. |
| Importação pelo chat | Preparar CSV, XLSX ou JSON, conferir a prévia normalizada e confirmar a adição de novas leituras. Registros idênticos são deduplicados por `record_key`. |
| Edição auditada | Corrigir um sensor de uma leitura com controle de versão e registro de antes/depois. No copiloto, a gravação exige confirmação do usuário. |
| Importações em fila | Acompanhar processamento, tentativas, resultados e reenvio de jobs com falha. |
| Atualizações em tempo real | Receber avisos de mudanças e recarregar os dados de outros clientes conectados. |
| Observabilidade | Investigar operações entre interface, API, cache, banco e processos de apoio. |
| Integrações | Receber leituras por webhook assinado e explorar a API pelo Swagger. |

As telas usam os registros persistidos no PostgreSQL. A atualização em tempo real comunica mudanças nessa base; a conexão com sensores físicos depende de uma fonte que envie os dados por importação ou webhook.

<details>
<summary><strong>Ver uma captura da interface</strong></summary>

![Tela da frota com indicadores, gráfico e tabela de telemetria](outputs/frota-componentes-padrao.png)

</details>

### Tecnologias

| Camada | Tecnologias e responsabilidade |
| --- | --- |
| Web e API | **Next.js 15**, **React 19** e **TypeScript**, com App Router e Route Handlers. |
| Interface | **Tailwind CSS 4**, **shadcn/ui**, **Recharts** e **TanStack Table**. |
| Estado e HTTP | **Zustand**, **Axios** e adaptadores de `fetch` com rastreamento. |
| IA | **DeepSeek**, **OpenUI** e eventos **AG-UI** enviados por SSE. |
| Persistência | **PostgreSQL 16**, **Prisma ORM 7** e adaptador `pg`. |
| Cache e mensagens | **Redis 7**, cache de leitura e publicação/assinatura de eventos. |
| Processamento assíncrono | **BullMQ**, worker e outbox transacional. |
| Autenticação | **Better Auth**, com integração Google preparada. |
| Contratos e validação | **Zod**, **OpenAPI** e **Swagger UI**. |
| Execução | **Node.js 22**, scripts via `tsx` e **Docker Compose**. O Dockerfile instala dependências com `npm ci`, usando o lockfile. |

As dependências estão em [package.json](package.json), com lockfile em [package-lock.json](package-lock.json).

## Início rápido com Docker

Este caminho sobe a aplicação e seus serviços juntos. Requisitos: **Git**, **Docker** e **Docker Compose**, com o Docker em execução e suporte a containers Linux.

### 1. Obtenha o projeto

```bash
git clone https://github.com/ompo-dev/Squad-Smart-Talent.git
cd Squad-Smart-Talent
```

Se você já tem o repositório, use a pasta existente.

### 2. Crie o arquivo de ambiente

No PowerShell:

```powershell
Copy-Item .env.example .env
```

No Linux ou macOS:

```bash
cp .env.example .env
```

Se `.env` já existir, preserve sua configuração. Para começar apenas com o dashboard, deixe `DEEPSEEK_API_KEY` vazio. Para usar o copiloto, substitua o valor de exemplo por uma chave válida do DeepSeek.

O Compose configura as conexões internas com PostgreSQL e Redis. Google e webhook podem ser configurados depois; veja [Variáveis de ambiente](#variáveis-de-ambiente).

### 3. Suba os serviços

```bash
docker compose build web
docker compose up -d
docker compose ps
```

O primeiro build instala dependências e compila a aplicação. Gere a imagem de `web` antes de subir os serviços: worker e gateway reutilizam essa imagem local. O serviço web aplica as migrações antes de iniciar, e os processos de apoio aguardam a aplicação ficar saudável.

| Endereço | Finalidade |
| --- | --- |
| [localhost:3000](http://localhost:3000) | Aplicação; redireciona para o dashboard. |
| [localhost:3000/docs](http://localhost:3000/docs) | Documentação interativa da API. |
| [localhost:3000/api/health](http://localhost:3000/api/health) | Saúde do banco e disponibilidade do Redis. |
| [localhost:3002/health](http://localhost:3002/health) | Saúde do gateway WebSocket. |

**Não é necessário ter um CSV para iniciar.** Para ver indicadores da sua frota, importe uma coleta após abrir a aplicação.

## Primeiro uso

1. Abra **Fontes de dados**, em `/dashboard/dados`.
2. Selecione o CSV `data/machine_downtime.csv` ou um arquivo com as colunas descritas em [Formato e importação dos dados](#formato-e-importação-dos-dados).
3. Clique em **Importar leituras**. Arquivos maiores entram na fila; acompanhe em **Importações**.
4. Consulte **Visão geral**, **Frota**, **Alertas** e **Relatórios**.
5. Com a chave DeepSeek configurada, abra **Copiloto IA** e pergunte: “Quais máquinas têm leituras em alerta?” ou “Mostre a temperatura média por dia”.

**Fontes de dados** reúne arquivos CSV, APIs externas e webhooks, com a data da última coleta, os últimos recebimentos e o estado real da conexão de atualização dos painéis. O recebimento por webhook já existe e exige `WEBHOOK_SECRET`; consultar periodicamente uma API externa ainda depende de um conector com endereço, autenticação, frequência e mapeamento definidos para a fonte escolhida. A conexão WebSocket atualiza as telas quando novas leituras chegam à base; a frequência das medições depende do sistema de origem.

No **Copiloto IA**, você pode arrastar até três arquivos de 5 MB para qualquer parte do chat ou usar **Anexar arquivo**. **Analisar arquivos** consulta o conteúdo sem gravar leituras. **Adicionar leituras** prepara CSV, XLSX ou JSON de telemetria: reconhece cabeçalhos equivalentes, separadores vírgula/ponto e vírgula/tabulação, números brasileiros e datas ISO ou brasileiras. O chat mostra uma amostra, duplicatas e erros; **Confirmar importação** inicia o processamento em fila. O sistema identifica registros idênticos pelo `record_key`, preserva dados existentes e registra as células corrigidas na prévia. PDFs com texto, TXT e Markdown ficam disponíveis para análise; campos ausentes ou ambíguos precisam ser corrigidos antes da importação. Fórmulas de planilhas usam somente o resultado já armazenado no arquivo.

| Tela | Caminho |
| --- | --- |
| Visão geral | `/dashboard` |
| Frota | `/dashboard/frota` |
| Alertas | `/dashboard/alertas` |
| Copiloto IA | `/dashboard/copiloto` |
| Fontes de dados | `/dashboard/dados` |
| Importações | `/dashboard/jobs` |
| Relatórios | `/dashboard/relatorios` |
| Observabilidade | `/dashboard/observabilidade` |
| Configurações — apresentação das áreas previstas | `/dashboard/configuracoes` |
| Login Google — depende de configuração | `/login` |

## Desenvolvimento local

Use este caminho para editar o código com recarga automática. Requisitos: **Node.js 22.12 ou superior na linha 22**, npm, PostgreSQL e Redis acessíveis. A imagem de execução do projeto usa Node.js 22.

### 1. Instale as dependências e configure o ambiente

```bash
npm ci
```

Crie `.env` a partir de [.env.example](.env.example), como no início rápido. As conexões padrão para os serviços locais são:

```dotenv
DATABASE_URL=postgresql://telemetry:telemetry@localhost:5432/telemetry
REDIS_URL=redis://localhost:6379
```

Você pode usar instalações próprias ou containers. Para disponibilizar os serviços localmente com Docker:

```bash
docker compose up -d postgres
docker run -d --name telemetry-redis-local -p 127.0.0.1:6379:6379 -v telemetry_redis_local:/data redis:7-alpine redis-server --appendonly yes --maxmemory-policy noeviction
```

O Redis do `docker-compose.yml` não publica a porta 6379 no host. Iniciar apenas `docker compose up -d redis` não atende aos processos fora do Docker; o container acima fornece esse acesso local. Nas próximas execuções, use `docker start telemetry-redis-local`.

### 2. Gere o cliente do banco e aplique as migrações

```bash
npx prisma generate
node --env-file=.env --run db:migrate
```

O cliente Prisma é gerado em `generated/prisma`. O script de migração também reconhece uma base de telemetria anterior sem histórico Prisma, registra a migração inicial como baseline e aplica as demais migrações.

### 3. Inicie os três processos

Execute cada comando em um terminal separado, na raiz do projeto:

```bash
# Terminal 1 — interface e API
npm run dev
```

```bash
# Terminal 2 — importações e publicação dos eventos da outbox
node --env-file=.env --run worker
```

```bash
# Terminal 3 — distribuição de eventos via WebSocket
node --env-file=.env --run realtime
```

O Next.js carrega `.env` automaticamente. Nos scripts independentes, `node --env-file=.env --run ...` carrega as variáveis antes de executar o script do `package.json`. Se elas já estiverem exportadas no ambiente, você pode usar os comandos `npm run worker`, `npm run realtime` e similares diretamente.

### 4. Prepare os arquivos do Swagger

Para acessar `/docs` em desenvolvimento, copie os assets locais uma vez após instalar as dependências:

```bash
npx tsx scripts/copy-doc-assets.ts
```

O comando `npm run build` já faz essa cópia automaticamente.

### Comandos disponíveis

| Comando | Função |
| --- | --- |
| `npm run dev` | Iniciar o Next.js em desenvolvimento, na porta 3000. |
| `npm run build` | Gerar o cliente Prisma, copiar os assets do Swagger e compilar o Next.js. |
| `npm run start` | Servir a aplicação compilada; execute o build e as migrações antes. |
| `npm run db:migrate` | Aplicar as migrações versionadas. |
| `npm run data:import` | Importar o CSV definido em `CSV_PATH` ou `data/machine_downtime.csv`. |
| `npm run worker` | Processar a fila e publicar eventos pendentes. |
| `npm run realtime` | Iniciar o gateway WebSocket, na porta 3002. |
| `npm run test:agent` | Executar os arquivos `tests/*.test.ts` sequencialmente. |
| `npm run typecheck` | Verificar os tipos TypeScript. |
| `npm run test:pipeline` | Testar convenções e fixture sintética sem banco. |
| `npm run test:ci` | Executar a suíte de aplicação com relatório JUnit em `reports/`. |
| `npm run test:e2e` | Verificar a stack HTTP, worker e WebSocket em execução. |
| `npm run db:seed:ci` | Alimentar uma base local descartável `telemetry_ci`, vazia e com `CI=true`. |
| `npx tsc --noEmit --incremental false` | Verificar tipos sem emitir arquivos nem atualizar o cache incremental. |

O script legado `npm run lint` ainda aponta para `next lint` e não tem configuração de ESLint. A CI executa explicitamente `npm run typecheck`, validação do Prisma e testes; não apresenta essa checagem de tipos como lint de estilo.

## Variáveis de ambiente

Use [.env.example](.env.example) como referência. `.env` é ignorado pelo Git e excluído da imagem pelo `.dockerignore`.

| Variável | Quando configurar | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | Obrigatória para acessar dados | Conexão PostgreSQL. No Compose, aponta para `postgres`. |
| `REDIS_URL` | Necessária para fila e eventos; usada também pelo cache | No Compose, aponta para `redis`; localmente, para `localhost:6379`. |
| `DEEPSEEK_API_KEY` | Para o copiloto | Chave válida, disponível somente no servidor. O valor de exemplo não autentica. |
| `DEEPSEEK_MODEL` | Opcional | Modelo enviado à API. Padrão definido no código: `deepseek-flash`. |
| `WEBHOOK_SECRET` | Para receber webhooks | Segredo com pelo menos 32 caracteres para assinatura HMAC-SHA256. |
| `BETTER_AUTH_URL` | Para o login e sua origem pública | Padrão: `http://localhost:3000`. |
| `BETTER_AUTH_SECRET` | Para habilitar o login Google | Segredo com pelo menos 32 caracteres. |
| `GOOGLE_CLIENT_ID` | Para habilitar o login Google | Identificador do cliente OAuth Google. |
| `GOOGLE_CLIENT_SECRET` | Para habilitar o login Google | Segredo do cliente OAuth Google. |
| `REALTIME_PUBLIC_URL` | Quando o navegador usa outro endereço WebSocket | No exemplo: `ws://localhost:3002`. Sem valor explícito, a API deriva o endereço do host da requisição. |
| `REALTIME_ALLOWED_ORIGINS` | Para origens adicionais no gateway | Lista separada por vírgulas; exemplo: `http://localhost:3000`. |
| `CSV_PATH` | Opcional, para o importador por terminal | Padrão: `data/machine_downtime.csv`. |
| `WEBHOOK_URL` | Opcional, para o script de envio | Padrão: `http://localhost:3000/api/webhooks/telemetry`. |
| `OBSERVABILITY_LOGS` | Opcional | `off` desliga os spans em stdout; a persistência no banco continua ativa. |

As três últimas opções não constam no `.env.example`. No Docker, variáveis novas precisam ser repassadas ao serviço pelo Compose ou com `-e` em `docker compose run`.

### Login Google

Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `BETTER_AUTH_SECRET`. Cadastre no cliente OAuth a URL de callback correspondente à origem da aplicação:

```text
http://localhost:3000/api/auth/callback/google
```

Sem as três variáveis válidas, o login permanece desabilitado e a interface informa a pendência. O dashboard continua acessível em modo de demonstração.

## Formato e importação dos dados

### CSV esperado

O projeto usa o **Machine Downtime.csv** (2.500 leituras, 3 máquinas, 3 linhas de montagem). O arquivo está em `data/machine_downtime.csv` e também em `docs/entrega-aula-1/dados/machine_downtime.csv`.

O dataset original pode ser importado diretamente; o sistema normaliza os cabeçalhos e limpa as células. As colunas canônicas são:

| Coluna | Significado | Exemplo |
| --- | --- | --- |
| `date` | Data (ou data e hora) da leitura, interpretada como UTC | `31-12-2021` |
| `machine_id` | Identificador textual da máquina | `Makino-L1-Unit1-2013` |
| `assembly_line` | Linha de montagem | `Shopfloor-L1` |
| `hydraulic_pressure_bar` | Pressão hidráulica em bar | `142.5` |
| `coolant_pressure_bar` | Pressão do refrigerante em bar | `5.4` |
| `air_system_pressure_bar` | Pressão do ar em bar | `6.2` |
| `coolant_temperature_c` | Temperatura do refrigerante em °C | `28.4` |
| `hydraulic_oil_temperature_c` | Temperatura do óleo hidráulico em °C | `52.1` |
| `spindle_bearing_temperature_c` | Temperatura do mancal do spindle em °C | `40.3` |
| `spindle_vibration_um` | Vibração do spindle em µm | `1.42` |
| `tool_vibration_um` | Vibração da ferramenta em µm | `32.7` |
| `spindle_speed_rpm` | Rotação do spindle em rpm | `21400` |
| `voltage_v` | Tensão em V | `412` |
| `torque_nm` | Torque em Nm | `38.6` |
| `cutting_kn` | Força de corte em kN | `12.4` |
| `downtime` | Rótulo de parada/falha | `No_Machine_Failure` |

Um arquivo mínimo válido (apenas data, máquina e linha são obrigatórias):

```csv
date,machine_id,assembly_line,coolant_temperature_c,spindle_vibration_um,downtime
31-12-2021,Makino-L1-Unit1-2013,Shopfloor-L1,28.4,1.42,No_Machine_Failure
31-12-2021,Makino-L2-Unit1-2013,Shopfloor-L2,29.1,1.51,Machine_Failure
```

O separador pode ser **vírgula**, **ponto e vírgula** ou **tabulação**. Valores com vírgula decimal podem estar entre aspas, por exemplo `"28,4"`. Datas aceitam `DD-MM-AAAA`, `DD/MM/AAAA`, `AAAA-MM-DD` e timestamps ISO 8601 com fuso; sem hora, a leitura é gravada à meia-noite UTC.

### Regras da carga e limpeza automática

- Cabeçalhos equivalentes em português/inglês são reconhecidos (por exemplo `Machine_ID`, `Assembly_Line_No`, `Hydraulic_Oil_Temperature(?C)`).
- Células vazias, sentinelas (`-999`, `NaN`, `N/A`), zeros em sensores físicos, negativos e valores acima da faixa física tornam-se `null` e geram um item em `quality_issues`.
- Outliers estatísticos (fora de Q1 − 3·IQR / Q3 + 3·IQR) são mantidos, mas sinalizados na qualidade da leitura.
- Rótulos `Machine_Failure`/`No_Machine_Failure` são convertidos em `downtime` booleano; rótulos desconhecidos viram `null` e são contabilizados.
- Linhas sem data, máquina ou linha de montagem são inválidas. Linhas sem nenhum sensor válido são mantidas e sinalizadas com `sem sensores`.
- Cada leitura recebe um `record_key` determinístico (SHA-256 do conteúdo limpo). Registros idênticos são deduplicados e reimportações não duplicam dados.
- O resultado informa linhas recebidas, válidas, inseridas, existentes, duplicadas e inválidas, além de células ausentes/zeradas/negativas/fora da faixa, outliers, rótulos ausentes e linhas sem sensores.
- Arquivos sem leituras válidas são rejeitados. O upload aceita até **5 MiB**, exibidos como 5 MB.

Pela API, arquivos de até **64 KiB** podem ser processados na própria requisição. Acima disso, ou com `?async=true`, a API retorna **202 Accepted** com a URL do job no cabeçalho `Location`.

### Importação por terminal

O dataset `data/machine_downtime.csv` acompanha o repositório. Para usar outra coleta, defina `CSV_PATH` ou substitua esse arquivo.

Com a aplicação no Docker:

```bash
docker compose --profile tools run --rm ingest
```

Com os serviços acessíveis localmente:

```bash
node --env-file=.env --run data:import
```

A carga por terminal executa o importador diretamente. A fila descrita acima é o fluxo de upload pela API/interface.

## Como funciona o copiloto

O chat combina **DeepSeek**, que interpreta a pergunta e solicita ferramentas, com **OpenUI**, que apresenta texto, indicadores, gráficos, tabelas e cartões de revisão.

1. A pergunta chega ao servidor com a conversa e até 18 mensagens anteriores de contexto.
2. O agente solicita ferramentas registradas para consultar a base ou pesquisar anexos.
3. O servidor valida os argumentos e executa a operação permitida.
4. O modelo interpreta os resultados e produz a resposta, transmitida progressivamente por **SSE** no protocolo **AG-UI**.
5. OpenUI monta a interface; conversas e mensagens ficam persistidas no PostgreSQL.

### Ferramentas disponíveis

| Ferramenta | Responsabilidade |
| --- | --- |
| `get_fleet_summary` | Resumir a frota e seus indicadores. |
| `query_telemetry` | Consultar leituras por ID, máquina, período e limites de sensores. |
| `aggregate_telemetry` | Calcular agregações por dia ou máquina. |
| `inspect_telemetry_schema` | Explicar as colunas disponíveis. |
| `get_alerts` | Consultar leituras com parada registrada ou sensor em faixa crítica de triagem. |
| `search_uploaded_file` | Ler ou pesquisar texto literal de um anexo, com referências às linhas. |
| `propose_telemetry_change` | Preparar a alteração de um sensor de uma leitura. |
| `analyze_uploaded_telemetry` | Normalizar e analisar um anexo de telemetria, retornando indicadores, amostra e série diária sem importar leituras. |
| `prepare_telemetry_import` | Validar um anexo e preparar o cartão de revisão da importação, sem gravar leituras. |

As consultas à base de telemetria usam parâmetros validados, transações somente de leitura e timeout SQL de cinco segundos. Consultas de leituras retornam até 200 linhas. São permitidas até oito chamadas de ferramentas por turno; o agente não recebe ferramentas de SQL livre nem de execução de comandos do sistema.

### Anexos e correções

Arraste arquivos para qualquer parte do chat ou use **Anexar arquivo**. São aceitos até **três anexos por mensagem**, de até **5 MiB por arquivo**: CSV, XLSX, JSON, PDF com texto, TXT e Markdown. O texto extraído fica em `chat_files`, limitado a 1,5 milhão de caracteres por arquivo. PDFs digitalizados precisam passar por OCR antes do envio.

O envio apresenta erros por arquivo, aceita os arquivos válidos de uma seleção mista e evita anexar o mesmo arquivo novamente. Uploads em andamento são cancelados ao trocar de conversa. Soltar ou anexar arquivos prepara o conteúdo para a conversa; a inclusão de leituras na base depende do fluxo abaixo.

| Ação | Comportamento |
| --- | --- |
| **Analisar arquivos** | Consulta o anexo sem importar leituras. Em CSV, XLSX e JSON de manutenção, aplica a mesma limpeza, calcula indicadores sobre todas as leituras válidas, com tabela de até 50 linhas e gráfico da temperatura do refrigerante dos até 200 dias mais recentes. |
| **Adicionar leituras** | Prepara uma prévia de CSV, XLSX ou JSON com amostra de até cinco leituras, contagens de linhas válidas, duplicadas e inválidas e exemplos de erros. |
| **Confirmar importação** | Envia o arquivo normalizado à fila. O cartão acompanha o processamento e apresenta quantas leituras foram adicionadas, já existiam ou foram ignoradas. Repetir a confirmação reutiliza o mesmo processamento. |

Para importar no chat:

1. Anexe um **CSV, XLSX ou JSON** com as colunas de manutenção (no mínimo data, máquina e linha).
2. Escolha **Adicionar leituras** ou peça na mensagem: “Prepare a importação deste arquivo”.
3. Confira o cartão **Revisar novas leituras**, incluindo amostra, datas, valores ausentes e erros.
4. Clique em **Confirmar importação** e acompanhe o resultado no cartão ou em **Importações**.

A normalização reconhece cabeçalhos equivalentes em português/inglês, como `date`/`data` e `machine_id`/`máquina`; separadores vírgula, ponto e vírgula ou tabulação; números com vírgula decimal; datas brasileiras e timestamps ISO 8601. JSON pode conter uma lista de objetos ou um objeto com `readings`, `leituras`, `data` ou `dados`. No XLSX, abas auxiliares são ignoradas e fórmulas usam somente o resultado já armazenado no arquivo.

Colunas obrigatórias ausentes ou ambíguas impedem a importação; o agente explica o problema para correção. Linhas inválidas e registros idênticos são contabilizados. Datas sem fuso são interpretadas como UTC; o cartão de revisão exibe horários de Brasília. PDF, TXT e Markdown permanecem disponíveis para análise.

O cartão de importação usa **ImportReview**; o agente prepara a prévia, e somente a confirmação inicia o processamento. Conteúdo de anexos é tratado como dado não confiável, nunca como instrução para o sistema. Indicadores de um anexo são apresentados como resultados daquele arquivo, sem misturá-los com as contagens da base persistida.

Para corrigir uma leitura, informe seu ID e o campo desejado. A IA prepara uma proposta com valor anterior, novo valor e motivo. A alteração só é gravada ao confirmar no cartão. Propostas expiram em 24 horas; alterações concorrentes exigem uma nova revisão.

O provedor recebe a pergunta, o contexto da conversa e os resultados das ferramentas, inclusive trechos de anexos consultados. A chave fica no servidor. A integração chama o DeepSeek diretamente e não exige chave do Gateway OpenUI.

## Arquitetura e fluxo de dados

O Next.js concentra interface e endpoints HTTP. Worker e gateway WebSocket são processos independentes. O PostgreSQL é a fonte de verdade; Redis apoia cache, fila e distribuição de eventos.

```mermaid
flowchart TD
    browser["Navegador: React, Zustand e OpenUI"] --> web["Next.js: páginas e API"]
    web --> commands["Command Bus: escritas e idempotência"]
    commands --> db[("PostgreSQL: dados, auditoria e outbox")]
    web --> db
    web --> redis[("Redis: cache, fila e eventos")]
    web --> ai["DeepSeek: ferramentas e respostas"]
    db -->|"Outbox e jobs pendentes"| worker["Worker: publicação e importação"]
    worker --> db
    worker --> redis
    redis --> gateway["Gateway WebSocket"]
    gateway -->|"Avisos de atualização"| browser
```

### Leituras e cache

Uma leitura interativa passa pelo componente, store Zustand e API. No servidor, o cache do Next.js consulta o Redis e, quando necessário, o Prisma/PostgreSQL. A renderização inicial no servidor acessa essa camada de leitura diretamente.

Os resultados têm TTL de **60 segundos**. Uma revisão numérica no PostgreSQL participa das chaves dos caches. Importações e alterações confirmadas incrementam essa revisão na mesma transação dos dados. Após o commit, o sistema sinaliza o Redis e invalida a tag do Next.js.

Se o Redis falhar, a leitura pode consultar o banco. A revisão no PostgreSQL evita reutilizar resultados de uma versão anterior mesmo se a invalidação falhar. Tabela, gráfico e indicadores de uma visão são carregados na mesma transação `REPEATABLE READ`.

### Escritas, concorrência e auditoria

O **Command Bus** centraliza escritas com tipo, payload e chave de idempotência. **Idempotência** significa que repetir a operação com a mesma chave devolve o resultado registrado, sem repetir seu efeito. Reutilizar a chave com outros dados gera conflito.

O resultado fica em `command_receipts`. Um lock transacional do PostgreSQL protege requisições concorrentes. Edições verificam `expectedVersion`: se a leitura mudou desde a consulta, a gravação retorna **409 Conflict**. A auditoria registra campo, motivo, versão e valores anterior e novo.

No chat, `chat_runs` identifica cada execução: mensagens em andamento não iniciam uma segunda execução, e respostas concluídas podem ser reproduzidas sem chamar novamente o provedor. No cliente, a confirmação de edição usa estado otimista e reverte a prévia em caso de falha.

### Fila, outbox e eventos

**Job** é uma tarefa processada em segundo plano. **Outbox** é o registro de um evento no mesmo banco e na mesma transação da operação que o originou. Assim, o worker pode tentar publicá-lo depois de uma falha temporária.

- O worker processa importações pelo BullMQ com concorrência **2**, até **cinco tentativas** e espera exponencial entre falhas recuperáveis.
- A outbox usa leases de 60 segundos e `FOR UPDATE SKIP LOCKED` para permitir múltiplos workers. Falhas de publicação são repetidas após cinco segundos.
- A cada 30 segundos, o worker procura jobs antigos que perderam sua entrada no Redis e tenta recuperá-los.
- Redis usa AOF e política `noeviction`. BullMQ retém até 1.000 jobs concluídos por 24 horas e até 1.000 falhos por sete dias; arquivo, metadados e resultado permanecem no PostgreSQL.
- O gateway distribui `telemetry.changed`, `job.submit`, `job.completed` e `job.failed`, com metadados de atualização e correlação.
- O cliente deduplica eventos e recarrega a visão ao reconectar. Pub/sub não conserva eventos para clientes desconectados; as consultas à API recuperam o estado atual.

**WebSocket** comunica mudanças nos dados e jobs. **SSE** transmite a resposta progressiva da IA. Em um proxy HTTPS, configure `REALTIME_PUBLIC_URL` com `wss://` e encaminhe o upgrade WebSocket; para o chat, preserve o streaming SSE.

## Padrões de desenvolvimento

Estas convenções orientam a evolução do código existente. A separação entre consultas e comandos é prática: o projeto usa módulos por responsabilidade dentro da mesma aplicação Next.js.

| Padrão | Como aplicar neste projeto |
| --- | --- |
| TypeScript estrito | Preserve `strict: true`; tipifique contratos e use `unknown` com validação para entradas externas. |
| Rotas HTTP enxutas | Valide a requisição, chame a operação de aplicação e traduza o resultado em resposta HTTP. |
| Comandos para escritas | Coloque operações em `lib/application/` e execute escritas pelo Command Bus. |
| Idempotência | Preserve a mesma `Idempotency-Key` ao repetir uma ação; gere outra para uma ação nova. |
| Controle de concorrência | Envie `expectedVersion` nas edições; trate 409 recarregando o registro antes de nova revisão. |
| Consultas controladas | Use Prisma e SQL com valores vinculados; campos e ordenações dinâmicos precisam de listas permitidas. |
| Validação com Zod | Valide payloads, filtros, limites e argumentos de ferramentas no servidor. |
| Estado no cliente | Use os stores Zustand de telemetria, comandos, eventos e traces; preserve invalidação e rollback. |
| Componentes reutilizáveis | Reutilize `components/ui/` e componha funcionalidades por responsabilidade. |
| Instrumentação | Use `tracedRoute` e `withSpan` nas operações instrumentadas; propague `traceparent`. |
| Contrato da API | Atualize `lib/openapi.ts` ao adicionar ou alterar uma rota. |
| Evolução do banco | Versione mudanças em `prisma/migrations/`; gere o cliente depois de alterar o schema. |

### Componentes e Atomic Design

| Diretório | Responsabilidade | Exemplos existentes |
| --- | --- | --- |
| `components/ui/` | Primitivas e blocos visuais shadcn/ui | Botões, cards, tabelas, gráficos e campos. |
| `components/atoms/` | Exportação de elementos básicos | `Button`, `Input`, `Textarea`, `Badge`. |
| `components/molecules/` | Pequenas combinações de elementos | Chip de anexo, comparação de valores e acesso ao login. |
| `components/organisms/` | Partes funcionais de uma tela | Composer, importador, login e painéis de jobs/observabilidade. |
| `components/templates/` | Composição da área de trabalho | `copilot-workspace.tsx`. |
| `app/` | Páginas, layouts e entrada das rotas HTTP | Dashboard e handlers em `app/api/`. |

Alguns componentes continuam diretamente em `components/`, e arquivos antigos reexportam implementações para preservar imports. Atomic Design orienta as áreas já estruturadas; nem todos os componentes foram migrados.

### Nomes e imports

- Use o alias `@/` para imports internos, conforme `tsconfig.json`.
- Mantenha arquivos de módulos/componentes em `kebab-case` e componentes React em `PascalCase`.
- Modelos Prisma usam propriedades em inglês e `@map` para as colunas do banco. CSVs, campos editáveis da API e webhooks usam as colunas canônicas em `snake_case`, como `coolant_temperature_c`, `spindle_vibration_um` e `downtime`.
- Mantenha segredos no ambiente do servidor, fora de componentes de cliente e de variáveis `NEXT_PUBLIC_*`.
- Preserve o estilo do arquivo editado. Ainda não há um formatador compartilhado configurado.

### Roteiro para adicionar uma funcionalidade

1. Defina entrada, saída e validação; atualize schema e migração se houver mudança persistente.
2. Implemente a operação na camada correspondente. Nas escritas, preserve transação, idempotência, versionamento e auditoria aplicáveis.
3. Exponha a rota e atualize o OpenAPI. Instrumente sem registrar conteúdo privado.
4. Conecte estado e interface, reaproveitando componentes. Trate carregamento, erro, vazio e conflito.
5. Verifique tipos, build e testes relevantes. Descreva na contribuição o comportamento alterado e a validação realizada.

## Fluxo de contribuição

O fluxo adotado é: **issue para definir o trabalho, branch para implementar, commits para registrar mudanças e pull request para revisar antes de integrar à `main`**. Para ajustes pequenos e claros, como um erro de digitação, a issue é opcional.

As regras abaixo são convenções de colaboração. A CI valida títulos de PRs e nomes de branches. Há um template de PR em `.github/pull_request_template.md`; hooks locais e templates de issues ainda não estão configurados. Proteções de branches e aprovações de ambientes dependem das configurações no GitHub.

### Branches

A `dev` recebe o desenvolvimento e alimenta a homologação. A `main` representa produção. Crie branches curtas a partir de `dev`, abra PRs para `dev` e promova uma entrega com um PR de `dev` para `main`. Correções urgentes em `fix/` podem ir para `main`; depois, replique a correção em `dev`. Cada branch deve resolver um objetivo; evite misturar correções independentes.

Use o formato:

```text
<tipo>/<numero-da-issue>-<descricao-curta>
```

| Prefixo | Quando usar | Exemplo |
| --- | --- | --- |
| `feat/` | Nova funcionalidade | `feat/42-filtro-por-maquina` |
| `fix/` | Correção de comportamento | `fix/43-importacao-data-invalida` |
| `docs/` | Documentação | `docs/44-guia-de-contribuicao` |
| `refactor/` | Reorganização sem alterar o comportamento | `refactor/45-separar-consultas-telemetria` |
| `test/` | Inclusão ou melhoria de testes | `test/46-concorrencia-de-edicoes` |
| `perf/` | Melhoria de desempenho | `perf/47-consulta-de-alertas` |
| `chore/` | Manutenção, dependências e ferramentas | `chore/48-atualizar-dependencias` |
| `ci/` | Automação de integração e entrega | `ci/49-validar-build-no-pr` |
| `build/` | Build, empacotamento e containers | `build/50-ajustar-imagem-docker` |

Use letras minúsculas, números e hífens, sem espaços ou acentos. O número corresponde a uma issue real. Sem issue, omita o número: `docs/corrigir-exemplo-csv`. Os números desta seção são ilustrativos.

Exemplo de criação da branch, com a árvore de trabalho limpa:

```bash
git switch dev
git pull --ff-only origin dev
git switch -c feat/42-filtro-por-maquina
```

Mantenha sua branch atualizada antes da revisão. Não reescreva o histórico de uma branch compartilhada sem combinar com quem está trabalhando nela. Após o merge, exclua a branch de trabalho.

### Commits: Conventional Commits

Use mensagens que expliquem **o que mudou**, no formato:

```text
<tipo>(<escopo>): <descricao>
```

O tipo é obrigatório. O escopo é opcional, mas ajuda a localizar a área afetada: `import`, `telemetry`, `copilot`, `jobs`, `auth`, `realtime`, `observability`, `api`, `ui`, `db` ou `docker`.

| Tipo | Significado | Exemplo |
| --- | --- | --- |
| `feat` | Nova funcionalidade | `feat(telemetry): adicionar filtro por maquina` |
| `fix` | Correção de bug | `fix(import): rejeitar datas fora do calendario` |
| `docs` | Documentação | `docs: explicar a execucao local` |
| `refactor` | Mudança interna sem alterar comportamento | `refactor(api): extrair validacao de comandos` |
| `test` | Inclusão ou ajuste de testes | `test(jobs): cobrir reenvio de importacao` |
| `perf` | Melhoria de desempenho | `perf(db): otimizar consulta de alertas` |
| `style` | Formatação do código, sem mudar sua lógica | `style(ui): padronizar indentacao` |
| `chore` | Manutenção e ferramentas | `chore(deps): atualizar dependencias` |
| `ci` | Automação de integração e entrega | `ci: verificar tipos nos pull requests` |
| `build` | Build e empacotamento | `build(docker): ajustar etapa de compilacao` |
| `revert` | Reversão de uma mudança anterior | `revert: desfazer alteracao no cache` |

Escreva a descrição com um verbo de ação, de forma curta e específica. Evite mensagens como `ajustes`, `update` ou `corrigido`. Prefira português nas descrições e mantenha tipos e escopos em inglês. Ao alterar aparência ou interação, use `feat` ou `fix` conforme o efeito; `style` é para formatação do código.

Cada commit deve representar uma mudança coerente. Quando precisar explicar a razão, acrescente um corpo separado do título por uma linha em branco. Referencie a issue no rodapé com `Refs #42`.

Uma mudança incompatível com contratos existentes deve ser marcada com `!` após o tipo/escopo ou com o rodapé `BREAKING CHANGE:`. Explique o impacto e como migrar:

```text
feat(api)!: exigir versao nas atualizacoes de leituras

A atualizacao passa a validar a versao consultada pelo cliente.

BREAKING CHANGE: clientes de PATCH /api/telemetry/records/{id}
precisam enviar expectedVersion obtida na consulta da leitura.
Refs #42
```

Os exemplos ilustram o formato; não representam mudanças pendentes. `feat` corresponde a uma evolução MINOR, `fix` a PATCH e uma mudança incompatível a MAJOR, quando houver versionamento semântico de releases. Essas mensagens, sozinhas, não publicam versões automaticamente.

### Issues

Antes de abrir uma issue, procure uma existente para o mesmo problema. Use um título que identifique o comportamento ou a entrega, e descreva o contexto para alguém que não participou da conversa.

| Categoria | Título de exemplo | Informações necessárias |
| --- | --- | --- |
| Bug | `[Bug] CSV com data invalida interrompe a importacao` | Passos para reproduzir, resultado esperado, resultado atual, ambiente e evidências. |
| Funcionalidade | `[Feature] Filtrar a frota por maquina` | Problema do usuário, proposta, limites de escopo e critérios de aceite. |
| Tarefa técnica | `[Task] Cobrir conflitos de edicao nos testes` | Objetivo, motivação, escopo e forma de validar a entrega. |
| Documentação | `[Docs] Explicar a configuracao do webhook` | Informação ausente/incorreta, público afetado e conteúdo esperado. |

Para bugs, informe o sistema operacional, a forma de execução (Docker ou local), a versão relevante e, quando disponível, o Trace ID. Compartilhe somente dados de exemplo ou evidências sem credenciais e conteúdo privado.

Modelo de issue de funcionalidade ou tarefa:

```markdown
## Problema ou objetivo

Quem é afetado e qual necessidade precisa ser atendida?

## Proposta e escopo

Qual comportamento deve ser entregue? Quais são os limites desta tarefa?

## Critérios de aceite

- [ ] O comportamento esperado está descrito de forma verificável.
- [ ] Os estados de erro e vazio aplicáveis estão definidos.
- [ ] A validação necessária para concluir a tarefa está indicada.

## Contexto

Capturas, exemplos, dependências e links relacionados.
```

Para bugs, acrescente uma sequência numerada de reprodução e separe **resultado esperado** de **resultado atual**. Use critérios concretos, como “ao filtrar pela máquina 24, a tabela exibe apenas leituras dessa máquina”, em vez de “o filtro funciona”.

Labels sugeridas para classificação: `bug`, `enhancement`, `documentation` e `task`. Use as que estiverem cadastradas no repositório; essa documentação não cria labels no GitHub.

### Pull requests

Abra um PR por objetivo, da sua branch para `dev`. Para publicar a entrega em produção, abra um PR de `dev` para `main`. Use **Draft** enquanto a implementação estiver em andamento e marque como pronto quando a mudança estiver revisável.

O título segue Conventional Commits, por exemplo: `feat(telemetry): adicionar filtro por maquina`. No corpo, explique o problema, o comportamento resultante e como validou. Inclua capturas para mudanças visuais e exemplos de requisição/resposta para alterações de API.

Modelo de descrição:

```markdown
## Problema e resultado

Qual problema existia e como o comportamento passa a funcionar?

## Alterações

- Mudanças necessárias para entender e revisar a solução.

## Validação

- Comandos executados e seus resultados.
- Fluxos verificados manualmente, quando aplicável.
- Verificações não executadas e o motivo, se houver.

## Impactos

Migrações, variáveis de ambiente, mudanças de contrato e orientações
para atualização, quando aplicáveis.

## Issue relacionada

Closes #42
```

Use `Closes #42` somente quando o PR resolver a issue inteira. Para uma entrega parcial ou relacionada, use `Refs #42`. Substitua os números pelos reais; o fechamento automático ocorre quando o PR é integrado à branch padrão.

Antes de pedir revisão:

- Confira o diff e remova arquivos gerados ou mudanças sem relação com o objetivo.
- Verifique tipos, build e os testes relevantes conforme [Testes e validação](#testes-e-validação). Não marque como executado o que não rodou.
- Atualize OpenAPI, migrações, exemplos e documentação quando a mudança exigir.
- Trate erros e conflitos e confirme que não incluiu segredos.
- Descreva as limitações conhecidas e resolva conflitos com a branch principal.

Solicite revisão de outra pessoa da squad e resolva os comentários antes do merge. Quando houver checks configurados, aguarde sua conclusão. Em trabalho individual, registre a própria revisão e as validações no PR.

Prefira **Squash and merge** para integrar uma entrega em um commit. Revise a mensagem final do squash para preservar o título no padrão Conventional Commits. Depois do merge, confira a issue relacionada e remova a branch de trabalho.

## Organização do repositório

| Caminho | Conteúdo |
| --- | --- |
| [app/](app/) | Páginas, estilos globais, APIs e documentação Swagger. |
| [components/](components/) | Interface, composição de telas e componentes OpenUI. |
| [hooks/](hooks/) | Hooks de interface compartilhados. |
| [lib/application/](lib/application/) | Command Bus, importação, comandos de edição, webhooks e execuções do chat. |
| [lib/stores/](lib/stores/) | Stores Zustand de comandos, telemetria, eventos e traces. |
| [lib/client/](lib/client/) | Cliente de autenticação e adaptadores HTTP instrumentados. |
| [lib/cache/](lib/cache/) | Conexão Redis e cache de telemetria. |
| [lib/jobs/](lib/jobs/) | Fila, publicação da outbox e reconciliação de jobs. |
| [lib/observability/](lib/observability/) | Contexto de trace, spans e instrumentação do cliente. |
| [lib/agent-tools.ts](lib/agent-tools.ts) | Ferramentas permitidas para o agente. |
| [lib/chat-agent.ts](lib/chat-agent.ts) | Integração DeepSeek e ciclo de chamadas de ferramentas. |
| [lib/openui-schema.ts](lib/openui-schema.ts) | Contrato de renderização das respostas de IA. |
| [lib/openapi.ts](lib/openapi.ts) | Contrato HTTP e documentação do protocolo WebSocket. |
| [prisma/](prisma/) | Modelos e migrações versionadas. |
| [scripts/](scripts/) | Importador, migrações, worker, gateway, envio de webhook e assets do Swagger. |
| [tests/](tests/) | Testes automatizados e verificações de integração. |
| [examples/webhook.json](examples/webhook.json) | Exemplo de lote para integração. |
| [outputs/](outputs/) | Capturas da interface. |
| [docker-compose.yml](docker-compose.yml) | Serviços, conexões internas, volumes e healthchecks. |
| [Dockerfile](Dockerfile) | Instalação, build e imagem de execução. |
| [.github/](.github/) | Pipelines CI/CD, atualização das actions e template de PR. |
| [deploy/](deploy/) | Compose de execução, script de deploy e exemplo de configuração por ambiente. |

As principais tabelas são `telemetry` para leituras; `chat_threads`, `chat_files` e `chat_runs` para o copiloto; `telemetry_changes` e `command_receipts` para auditoria/idempotência; `import_jobs` e `outbox_events` para processamento; `cache_revisions` e `trace_events` para consistência e observabilidade; e `auth_*` para o Better Auth.

## API e integrações

O contrato completo fica em [Swagger](http://localhost:3000/docs), com JSON em [/api/openapi](http://localhost:3000/api/openapi). Os assets são servidos localmente; o Swagger não envia o schema a um validador externo.

### Principais endpoints

| Método | Endpoint | Finalidade |
| --- | --- | --- |
| `GET` | `/api/telemetry/view?mode=latest` | Última leitura por máquina; também aceita `alerts` e `readings`. |
| `GET` / `PATCH` | `/api/telemetry/records/{id}` | Consultar uma leitura ou editar um sensor com versão esperada. |
| `POST` | `/api/import` | Importar CSV multipart no campo `file`. |
| `POST` | `/api/import/attachment` | Preparar, confirmar ou consultar a importação de um anexo do chat. |
| `GET` | `/api/jobs` e `/api/jobs/{id}` | Listar jobs ou consultar estado e resultado. |
| `POST` | `/api/jobs/{id}/retry` | Reenviar uma importação com falha. |
| `POST` | `/api/chat` | Conversa persistida com streaming SSE. |
| `POST` | `/api/analysis` | Executar uma consulta tipada pelas ferramentas permitidas. |
| `POST` | `/api/uploads` | Extrair e armazenar texto de um anexo. |
| `GET` / `POST` | `/api/changes/{id}` | Consultar uma proposta ou confirmar sua aplicação. |
| `POST` | `/api/webhooks/telemetry` | Receber um lote de leituras assinado. |
| `GET` | `/api/realtime/config` | Consultar endereço e protocolo do WebSocket. |
| `GET` | `/api/observability` e `/api/metrics` | Consultar traces e métricas Prometheus. |
| `GET` | `/api/health` e `/api/jobs/health` | Consultar saúde dos serviços e da fila. |
| `GET` | `/api/auth/status` | Verificar se o login está configurado. |

O Swagger também documenta criação, leitura, renomeação, exclusão e importação de conversas. `/api/ai` e `/api/dashboard` são rotas de compatibilidade; novas integrações devem preferir `/api/chat` e `/api/telemetry/view`.

### Importação de anexos pela API

Envie o arquivo no campo multipart `file` de `POST /api/uploads` e use o `id` retornado em `POST /api/import/attachment`. O corpo aceita até **4 KiB**:

```json
{
  "action": "preview",
  "fileId": "UUID retornado pelo upload"
}
```

A prévia retorna `hash`, contagens e uma amostra das leituras normalizadas. Após a revisão, envie `action: "confirm"`, o mesmo `fileId` e o valor de `hash` no campo `previewHash`. Para acompanhar, use `action: "status"` com `fileId` e `previewHash`.

`preview` não grava leituras; `confirm` envia uma importação à fila e responde **202** enquanto estiver aguardando ou processando. Confirmações repetidas reutilizam o mesmo job. Uma prévia que não corresponda ao arquivo recebe **409**. O resultado concluído informa leituras inseridas, existentes, duplicadas e inválidas. O fluxo do chat usa os mesmos endpoints, com confirmação no cartão.

### Exemplo: consultar e corrigir uma leitura

Consulte `GET /api/telemetry/records/1`. A resposta inclui `version` e `ETag`. Envie a versão consultada no corpo do `PATCH /api/telemetry/records/1`, junto de uma `Idempotency-Key` para a operação:

```json
{
  "expectedVersion": 0,
  "field": "coolant_temperature_c",
  "value": 28.8,
  "reason": "Correção após conferência da coleta"
}
```

Campos editáveis são as 12 colunas de sensores: `hydraulic_pressure_bar`, `coolant_pressure_bar`, `air_system_pressure_bar`, `coolant_temperature_c`, `hydraulic_oil_temperature_c`, `spindle_bearing_temperature_c`, `spindle_vibration_um`, `tool_vibration_um`, `spindle_speed_rpm`, `voltage_v`, `torque_nm` e `cutting_kn`. O valor pode ser numérico ou `null`, dentro das faixas físicas validadas. Um conflito retorna 409; consulte novamente a leitura antes de tentar outra alteração.

### Webhook de telemetria

O endpoint recebe o formato de [examples/webhook.json](examples/webhook.json), com `eventId` e uma lista `readings`. Limites: **500 leituras** e **512 KiB** por lote.

- O `record_key` é derivado do conteúdo limpo da leitura. Para atualizar um registro existente, envie o `record_key` retornado na criação e o `expectedVersion`; sem `record_key`, a leitura é tratada como nova.
- Um conflito desfaz o lote inteiro.
- `eventId` identifica a entrega: repetir o mesmo evento é idempotente; mudar seu conteúdo exige outro identificador.
- Sensores usam as colunas canônicas em `snake_case` e números ou `null`; `date` usa ISO 8601 com fuso.

| Cabeçalho obrigatório | Valor |
| --- | --- |
| `X-Webhook-Timestamp` | Timestamp Unix em segundos, com tolerância de cinco minutos. |
| `X-Webhook-Signature` | `sha256=<hexadecimal do HMAC-SHA256>`. |

A assinatura usa `WEBHOOK_SECRET` como chave e os bytes de **`timestamp + '.' + corpo JSON exato`** como mensagem. Reformatar o corpo depois de assinar invalida o HMAC.

Para enviar o exemplo, instale as dependências locais e configure o mesmo `WEBHOOK_SECRET` no servidor e no `.env` do script:

```bash
npx tsx scripts/send-webhook.ts examples/webhook.json
```

O script carrega `.env`, gera os cabeçalhos e envia o arquivo. A integração recebe webhooks; não implementa cadastro nem entrega de webhooks de saída.

## Observabilidade

Um **trace** reúne as etapas de uma operação; cada **span** registra uma etapa e sua duração. O contexto W3C `traceparent` conecta componente, Zustand, API, Command Bus, cache, banco, worker e eventos.

Respostas instrumentadas retornam `X-Trace-Id` e `traceparent`. Use o Trace ID em `/dashboard/observabilidade`. A tela consulta as últimas 24 horas: até 100 eventos recentes sem filtro ou até 300 spans por trace.

Os spans ficam em `trace_events` e são emitidos como JSON em stdout. `/api/metrics` exporta métricas Prometheus de comandos, duração, cache, jobs e outbox. Para acompanhar os processos:

```bash
docker compose logs -f web worker realtime
```

Web, worker e realtime têm rotação de logs de 10 MB, com três arquivos. A instrumentação filtra atributos e não registra perguntas, anexos, payloads de comandos, SQL, cookies, tokens ou credenciais. Uma falha na persistência dos spans não reverte um comando confirmado.

## Testes e validação

A suíte usa o executor do Node.js via `tsx`. Verifica consultas, importação, streaming, conversas, edições, concorrência, idempotência, rollback, traces, cache, OpenAPI, webhook e jobs. [tests/chat-attachments.test.ts](tests/chat-attachments.test.ts) cobre limites de anexos, normalização de CSV/XLSX/JSON, datas com fuso, fórmulas armazenadas, arquivos malformados, prévias sem gravação, confirmação idempotente e renderização do contrato `ImportReview`. Também verifica que indicadores usam o arquivo completo mesmo quando tabela e gráfico são limitados.

**Pré-requisitos da suíte de integração:** PostgreSQL com migrações aplicadas, Redis acessível e uma base com **2.500 leituras, 3 máquinas e 164 dias**, incluindo máquinas em faixa crítica. A CI gera essa base com dados sintéticos, sem depender do CSV original. O comando `npm run db:seed:ci` exige `CI=true`, um banco local chamado `telemetry_ci` e a tabela de leituras vazia; recusa sobrescrever uma base existente.

Os testes usam banco e Redis reais e criam registros temporários. Execute em um ambiente dedicado de desenvolvimento/teste, com o worker parado para evitar processamento das fixtures de fila. O provedor de IA é simulado; não é necessário consumir a API real.

Com Docker e uma base de teste compatível preparada:

```bash
docker compose stop worker
docker compose exec web npm run test:agent
docker compose start worker
```

Localmente, após interromper o processo de worker:

```bash
node --env-file=.env --run test:agent
```

Os arquivos executam sequencialmente porque compartilham a base. Para verificar tipos e compilação:

```bash
npx tsc --noEmit --incremental false
npm run build
```

Gere o cliente Prisma antes da checagem de tipos. `test:agent` inclui apenas `tests/*.test.ts`; auxiliares como `tests/docker-flow.ts` não fazem parte dessa execução automática.

## CI/CD: desenvolvimento e produção

A automação fica em [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml), com deploy reutilizável e manual em [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

**CI** verifica se uma alteração está apta a ser integrada. **CD** publica a imagem validada e, quando o ambiente estiver configurado, instala essa versão no servidor.

| Etapa | `dev` — homologação | `main` — produção |
| --- | --- | --- |
| Entrada normal | PR de uma branch `feat/`, `fix/`, `docs/` etc. | PR de promoção vindo de `dev`; `fix/` para correções urgentes. |
| CI | Executada em PRs e pushes. | Executada em PRs e pushes. |
| Publicação | Imagem GHCR com tag `dev-<commit>`. | Imagem GHCR com tag `prod-<commit>`. |
| Deploy | GitHub Environment `dev`. | GitHub Environment `prod`. |
| Dados e serviços | Projeto Compose `telemetry-dev`, com seus próprios volumes. | Projeto Compose `telemetry-prod`, com seus próprios volumes. |
| Aprovação | Pode ser automática, conforme a configuração do Environment. | Configure revisores obrigatórios e permita apenas a branch `main`. |

O fluxo normal é **branch de trabalho → PR para `dev` → homologação → PR de `dev` para `main` → produção**. Os ambientes não compartilham banco, volumes, senhas, URLs ou diretório de releases. A mesma receita de build é usada nos dois; cada branch publica sua imagem validada, e o deploy usa o digest exato dessa imagem. Promover código de `dev` para `main` executa novamente as verificações.

### O que o pipeline executa

1. Valida o título do PR no padrão Conventional Commits, a branch e seu destino. Não reescreve mensagens de commits locais.
2. Executa testes das regras de contribuição e dos dados sintéticos, além de cenários de falha/recuperação do deploy com Docker simulado.
3. Instala dependências com `npm ci`, gera e valida o Prisma e verifica os tipos.
4. Sobe PostgreSQL e Redis temporários, aplica migrações e gera 2.500 leituras sintéticas para a suíte de integração.
5. Executa os testes com relatório JUnit e compila a aplicação.
6. Constrói a imagem Docker e sobe web, worker, gateway, PostgreSQL e Redis em uma stack descartável.
7. Verifica HTTP, Swagger, assets, webhook assinado, conflitos de edição, idempotência, fila, retry, WebSocket e traces distribuídos.
8. Em pushes para `dev` ou `main`, publica **a mesma imagem testada**, identificada por digest `sha256`. PRs não publicam imagens nem fazem deploy.
9. Chama o deploy do ambiente, caso `DEPLOY_ENABLED=true` esteja configurado nele.

O Dockerfile instala pelo lockfile e executa a aplicação como usuário `node`. As actions estão fixadas por SHA; o Dependabot propõe atualizações dessas referências em PRs para `dev`. Os relatórios de testes são retidos por 14 dias e os logs dos containers de CI por sete dias. Os bancos e volumes de CI são descartados ao terminar.

### Ativação dos ambientes

A publicação no GHCR usa o `GITHUB_TOKEN` da execução, com `packages: write` no job correspondente. Autorize o GitHub Actions a criar pacotes no repositório/organização. Os builds de PR não precisam de credenciais de deploy.

Para a instalação remota, prepare um servidor **Linux x86-64** com Docker Engine, Docker Compose v2 com suporte a `--wait`, Bash, gzip e acesso SSH. O usuário de deploy precisa conseguir executar Docker e escrever no diretório escolhido. O workflow não provisiona uma máquina, DNS ou certificado TLS.

Em **Settings → Environments**, configure `dev` e `prod` separadamente:

| Tipo | Nome | Conteúdo |
| --- | --- | --- |
| Variable | `DEPLOY_ENABLED` | `true` para habilitar a instalação; ausente ou outro valor mantém somente CI e publicação. |
| Variable | `DEPLOY_PATH` | Caminho absoluto exclusivo do ambiente, sem espaços, pontos ou barra final; exemplo: `/srv/telemetryos/dev` ou `/srv/telemetryos/prod`. |
| Variable | `DEPLOY_PORT` | Porta SSH; padrão 22. |
| Variable | `APP_URL` | URL pública do dashboard, usada no link do Environment. |
| Secret | `DEPLOY_HOST` | Hostname ou IPv4 do servidor SSH. |
| Secret | `DEPLOY_USER` | Usuário SSH. |
| Secret | `DEPLOY_SSH_KEY` | Chave privada autorizada nesse usuário. |
| Secret | `DEPLOY_KNOWN_HOSTS` | Entrada `known_hosts` da chave do servidor, conferida por um canal confiável; inclua a porta no formato SSH quando não for 22. |
| Secret | `DEPLOY_ENV_FILE` | Conteúdo completo do `.env` de execução, baseado em [deploy/.env.example](deploy/.env.example). |

O segredo `DEPLOY_ENV_FILE` deve ter valores próprios por ambiente: senha PostgreSQL e `DATABASE_URL` correspondente, URL HTTP pública, URL WSS pública, origens permitidas e credenciais opcionais de IA, login e webhook. Use uma senha de banco hexadecimal para evitar caracteres que precisariam de escape na URL.

Se os ambientes usam a mesma máquina, escolha portas diferentes: por exemplo, web/realtime **3100/3102 em dev** e **3000/3002 em prod**. Essas portas são publicadas apenas em `127.0.0.1`. Configure um proxy reverso no host com HTTPS/WSS, upgrade WebSocket e streaming SSE. PostgreSQL e Redis não expõem portas no arquivo de deploy.

> **Ativação pendente de infraestrutura:** o código dos pipelines não fornece host, chaves SSH, domínios nem credenciais. Sem `DEPLOY_ENABLED=true`, o job registra que o deploy não foi habilitado; uma imagem publicada não significa que uma aplicação foi instalada. Com o deploy habilitado, a falta de configuração faz a execução falhar explicitamente.

O ambiente `prod` deve aceitar somente `main`; `dev`, somente `dev`. Configure proteção de branches com os checks **Contribution conventions**, **Types, tests and build** e **Container integration and image**, revisão de PRs e bloqueio de pushes diretos conforme a política da squad. Esses controles administrativos precisam ser habilitados no GitHub; os arquivos não os ativam automaticamente.

### Instalação, migração e recuperação

[deploy/compose.yml](deploy/compose.yml) define a stack de execução, separada do Compose local. [deploy/deploy.sh](deploy/deploy.sh) recebe o ambiente e o digest, valida a configuração e:

1. Baixa a imagem antes de substituir os processos em execução.
2. Aguarda PostgreSQL e Redis e grava um backup PostgreSQL comprimido antes da migração.
3. Para o worker e aplica as migrações em um container específico, uma única vez por execução de deploy.
4. Atualiza web, worker e gateway e aguarda os healthchecks, exigindo banco e Redis saudáveis.
5. Registra a release atual e a anterior; se a nova aplicação falhar, tenta restaurar a imagem/configuração da release anterior e marca o deploy como falho.

A autenticação no GHCR é temporária e o script faz logout ao terminar. Chaves de host SSH são verificadas; não há descoberta automática de confiança. Dois deploys do mesmo Environment não executam simultaneamente pelo workflow.

Os diretórios `releases/` e `backups/` permanecem sob `DEPLOY_PATH`. Cada release tem configuração sensível e permissões restritas. Defina retenção, monitore espaço e copie backups para um destino externo ao servidor. O pipeline não remove backups nem volumes de ambientes implantados.

**Rollback da aplicação não desfaz migrações do banco.** Use migrações compatíveis com a versão anterior, no modelo expandir/migrar/contrair. Se uma migração falhar, confira o estado Prisma antes de repetir; não há reset automático nem restauração silenciosa de backup. A substituição dos containers também pode causar uma breve interrupção: este fluxo não implementa blue/green nem garante indisponibilidade zero.

### Reexecução e rollback manual

Em **Actions → Deploy dev or prod → Run workflow**, selecione a branch correspondente ao ambiente e informe o digest de uma imagem anteriormente validada/publicada:

```text
ghcr.io/ompo-dev/squad-smart-talent@sha256:<64-caracteres-hexadecimais>
```

Use a branch `dev` para o ambiente `dev`, ou `main` para `prod`. O workflow rejeita combinações diferentes e imagens fora do pacote do próprio repositório. A execução manual usa o mesmo fluxo, backup, migrações e healthchecks; antes de reverter, confirme a compatibilidade do schema com a imagem escolhida.

Para verificar os testes independentes de banco localmente:

```bash
npm run test:pipeline
```

A suíte de aplicação e a integração Docker continuam dependendo dos serviços descritos em [Testes e validação](#testes-e-validação). Os cenários do script de deploy rodam na CI com `bash tests/deploy.test.sh`.

Referências: [GitHub Actions](https://docs.github.com/en/actions), [workflows reutilizáveis](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows) e [build de imagens](https://github.com/docker/build-push-action).

## Operação e solução de problemas

### Comandos de rotina

| Comando | Uso |
| --- | --- |
| `docker compose ps` | Ver estado e saúde dos serviços. |
| `docker compose logs -f web worker realtime` | Acompanhar logs. |
| `docker compose up --build -d` | Recompilar e subir após mudanças no código. |
| `docker compose up -d --force-recreate web worker realtime` | Recriar processos após alterar variáveis repassadas pelo Compose. |
| `docker compose up -d --scale worker=2` | Subir duas instâncias do worker. |
| `docker compose down` | Parar a stack e preservar os volumes de dados. |

O PostgreSQL usa o volume `telemetry_pg`, e o Redis, `telemetry_redis`, sob o projeto Compose `d-a`. `docker compose down -v` remove esses volumes e seus dados; não faz parte do fluxo normal de atualização.

### Problemas frequentes

| Sintoma | O que verificar |
| --- | --- |
| Docker não conecta ao daemon | Inicie o Docker Desktop/serviço Docker e confirme o uso de containers Linux. |
| Primeiro início tenta baixar `d-a-web` e retorna `pull access denied` | Execute `docker compose build web` antes de `docker compose up -d`; worker e gateway usam a imagem local da aplicação. |
| Porta 3000, 3002 ou 5432 ocupada | Verifique outros serviços ou outra stack do projeto antes de iniciar. |
| Dashboard vazio | Importe o `data/machine_downtime.csv` em **Fontes de dados** ou execute `npm run data:import`. |
| Arquivo anexado sem novas leituras no painel | No chat, escolha **Adicionar leituras** e confirme no cartão. A análise de anexos consulta o arquivo sem gravar leituras. |
| Prévia indica campos ausentes ou ambíguos | Confira as colunas de manutenção (no mínimo data, máquina e linha) e remova colunas duplicadas que representem o mesmo campo. Arquivos sem essa estrutura continuam disponíveis para análise. |
| API externa não atualiza a base | Defina a origem e implemente o conector com endereço, autenticação, frequência e mapeamento; a tela ainda não cadastra nem consulta APIs automaticamente. |
| Copiloto indisponível | Confira chave, modelo e logs de `web`. Chave recusada, saldo insuficiente e limite do provedor geram erros próprios. |
| Importação permanece na fila | Confira worker, Redis, `/api/jobs/health` e logs. Reenvie pelo painel se o job estiver em falha. |
| CSV rejeitado | Confira cabeçalhos, separador, datas, extensão e tamanho; consulte os erros no resultado. |
| Edição retorna 409 | A versão mudou ou a chave foi reutilizada com outro payload. Recarregue e revise antes de uma nova ação. |
| Dados não atualizam entre navegadores | Verifique `realtime`, a URL em `/api/realtime/config`, origens permitidas e upgrade WebSocket no proxy. |
| `/docs` abre sem a interface Swagger no modo local | Execute `npx tsx scripts/copy-doc-assets.ts`. |
| Login Google desabilitado | Confira credenciais, segredo de autenticação e callback. |
| Webhook retorna 401 | Compare segredo, timestamp e corpo assinado; use o script de envio como referência. |
| Webhook retorna 503 | Configure `WEBHOOK_SECRET` com pelo menos 32 caracteres no servidor. |
| Healthcheck retorna `degraded` | O banco está acessível, mas o Redis não está pronto. Leituras podem funcionar; fila e eventos dependem do Redis. |
| Testes falham nas contagens da frota | Use a fixture sintética em um banco descartável `telemetry_ci` ou uma coleta compatível, sem leituras extras. |

## Limites atuais

- **Acesso compartilhado:** autorização, controle por papel e isolamento por usuário ainda precisam ser implementados. Ativar OAuth não resolve essas etapas.
- **Configurações:** a página apresenta áreas previstas; ainda não permite salvar limites operacionais, canais de notificação ou credenciais.
- **Alertas:** os limiares são fixos e indicam triagem. A aplicação não implementa diagnóstico preditivo nem controle físico das máquinas.
- **Dados:** as telas representam o conteúdo recebido no PostgreSQL. Conectores de sensores precisam alimentar essa base.
- **Anexos:** PDF, TXT e Markdown são usados para análise; PDFs digitalizados exigem OCR prévio. A importação de CSV, XLSX e JSON requer no mínimo data, máquina e linha, uma prévia válida e confirmação. Fórmulas de planilhas não são recalculadas.
- **APIs externas:** o painel apresenta a opção de integração, mas a consulta periódica depende de um conector para a fonte escolhida. O recebimento de leituras por webhook assinado já está implementado.
- **Eventos:** WebSocket exige gateway ativo e Redis acessível. Ao reconectar, o cliente consulta a API para recuperar o estado.
- **Qualidade automatizada:** a CI usa fixture sintética e testa tipos, contratos, aplicação e containers; lint de estilo ainda precisa de configuração.
