# Painel do Gestor — Grupo 4 · Tema 1 (OEE)

**Pergunta:** qual máquina vai parar, quanto isso custa e o que fazer primeiro?

Esta pasta traduz os dados das máquinas para a linguagem de gestão: custo em reais, disponibilidade, prioridade e plano de ação. Usa o dataset do tema (Machine Downtime) e não altera o app, o banco nem a entrega da Aula 1.

| Melhoria | O que responde | Onde ver |
| --- | --- | --- |
| 1. Custo da parada | Quanto as falhas custaram em R$ | [resumo.md](resultados/resumo.md), [gráfico](resultados/custo_por_maquina.svg) |
| 2. OEE com plano de coleta | Disponibilidade de cada máquina e o que falta medir | [resumo.md](resultados/resumo.md) e seção abaixo |
| 3. Risco em R$ | Chance de falha prevista pelos sensores × custo da falha | [risco_por_maquina.csv](resultados/risco_por_maquina.csv), [gráfico](resultados/sensores_falha.svg) |
| 4. Preditiva × corretiva | Quanto a manutenção preditiva economiza por mês | [resumo.md](resultados/resumo.md) |
| 5. Plano 5W2H | O quê, por quê, onde, quando, quem, como e quanto | [plano_5w2h.md](resultados/plano_5w2h.md) |

## Como executar

Requer Python 3 com `numpy` (já disponível no Google Colab). Os comandos rodam de dentro de `docs/site-generativo/calculos/`.

| Comando | O que faz |
| --- | --- |
| `python scripts/painel_gestor.py` | Processa o dataset inteiro do zero e grava `resultados/` |
| `python scripts/painel_gestor.py lote novo.csv` | Recebe um lote novo, guarda no histórico sem duplicar e recalcula o painel. Reaprende o modelo a cada 7 dias de dados novos. |
| `python scripts/painel_gestor.py recalcular` | Recalcula o painel com o histórico atual |
| `python scripts/painel_gestor.py treinar` | Força o modelo a reaprender |
| `python scripts/painel_gestor.py semanal` | Mostra a mensagem de WhatsApp da semana e um link para enviar |
| `python scripts/painel_gestor.py simular` | Teste: divide o dataset em 30 lotes semanais, processa um por um, reenvia um lote e confere que nada se perdeu nem duplicou |

O histórico e o modelo ficam em `estado/` (fora do Git). Cada comando confere os próprios resultados; se uma conferência falhar, o painel não é gravado.

**Outras máquinas e datasets.** O arquivo `config/machine_downtime.json` diz qual coluna é a máquina, a data, a falha e os sensores, e guarda as premissas com fonte. Para outro dataset, copie esse arquivo, ajuste os nomes e use `--config config/novo.json`. Requisito: o dataset precisa ter uma coluna que diga se a máquina falhou.

## Integração com o app (proposta, depende do grupo)

O script grava `resultados/painel.json`, pensado para ser lido pelo app:

| Etapa | Como encaixa |
| --- | --- |
| Dados chegam | O app já recebe CSV e webhook; cada lote salvo vira um arquivo para `painel_gestor.py lote` |
| Recálculo a cada lote | O worker do app chama o comando `lote` depois de cada importação |
| Retreino semanal | Automático dentro do comando `lote` (7 dias de dados novos) |
| Tela "Gestão" e IA | A página e uma nova ferramenta do copiloto leem `painel.json` (campos: `frota`, `maquinas`, `sensores`, `plano_5w2h`, `modelo`, `lotes`) |
| WhatsApp | `semanal` gera o texto e um link; o envio automático exige conta do WhatsApp Business |

## Premissas e fontes

| Premissa | Valor | Fonte |
| --- | --- | --- |
| Custo direto de uma hora parada | R$ 189,78/h | Preço médio da hora-máquina de centro de usinagem 3 eixos na Grande São Paulo. Pesquisa GRV Software com 480 empresas, divulgada em 28/08/2024 ([Usinagem Brasil](https://www.usinagem-brasil.com.br/59239-sai-nova-pesquisa-sobre-preco-da-hora-maquina-em-usinagem/)). É o custo de reposição: quanto a fábrica pagaria para terceirizar a hora de usinagem perdida. Custos indiretos (linha parada, multas, atraso de entrega) ficam fora. |
| Duração média de uma parada | 1,08 h (27 h ÷ 25 paradas por mês) | Siemens, *The True Cost of Downtime 2024*, pesquisa com 181 profissionais de grandes indústrias, 2019–2023 ([PDF](https://assets.new.siemens.com/siemens/assets/api/uuid:1b43afb5-2d07-47f7-9eb7-893fe7d0bc59/TCOD-2024_original.pdf)). |
| Redução de paradas com preditiva | 50% | Mesmo relatório da Siemens. |
| Horas disponíveis por dia | 24 h | Convenção do grupo: o dataset não informa turnos. |
| OEE de referência | 85% classe mundial; 55–60% típico | Nakajima, *Introduction to TPM* (1984); base da Evocon com 3.500+ máquinas em 50+ países ([Evocon](https://evocon.com/kb/oee-targets)). |
| Dataset | 2.500 registros, 3 máquinas Makino, nov/2021–jul/2022 | *Optimization of machine downtime*, Srinivas Anusuri, Kaggle, licença CC0 ([link](https://www.kaggle.com/datasets/srinivasanusuri/optimization-of-machine-downtime)). |

Todas as premissas ficam no topo do script. Trocar um valor e executar de novo atualiza todos os resultados.

## Plano de coleta para o OEE completo

OEE = disponibilidade × desempenho × qualidade. O dataset permite medir só a disponibilidade. Para os outros dois pilares, a fábrica precisa registrar:

| Pilar | Dado que falta | Como coletar |
| --- | --- | --- |
| Disponibilidade (melhor) | Início e fim de cada parada; horas planejadas por turno | Apontamento no painel da máquina ou no MES |
| Desempenho | Tempo de ciclo ideal e peças produzidas por hora | Contador de peças do CNC |
| Qualidade | Peças boas e peças refugadas | Registro da inspeção de qualidade |

## Limites

- **Os valores em R$ ilustram o método, não o caixa de uma fábrica real.** O dataset tem cerca de 50% de falhas, bem acima de uma operação real, e não informa a duração das paradas.
- O custo por hora usa o preço de um centro de 3 eixos. Máquinas Makino de 4 ou 5 eixos tendem a custar mais, então o valor é conservador.
- A Siemens vende soluções de manutenção preditiva; os números do relatório têm interesse comercial.
- O risco é uma regressão logística simples. No primeiro treino ela é testada nos 30% de registros mais recentes; depois, a cada retreino, o modelo antigo é testado na semana nova, que ele nunca viu. Ela indica associação entre sensores e falhas, não causa.
- A limpeza aqui é mínima (campos vazios viram ausentes). A limpeza completa do dataset é a tarefa de Pandas do grupo.
