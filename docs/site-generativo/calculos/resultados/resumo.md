# Resumo do Painel do Gestor

Dataset: Machine Downtime (Kaggle, CC0) · 3 centros de usinagem Makino. Período: 24/11/2021 a 03/07/2022 (7,3 meses), 2500 registros, 3 máquinas, 1 lote(s) recebido(s).

## 1. Custo das paradas
- 1265 falhas x 1,08 h x R$ 189,78/h = **R$ 259.277** no período (**R$ 35.551 por mês**).
- Última semana: 1 falhas, R$ 205.

## Alertas
- Makino-L3-Unit1-2015 sem enviar dados há 26 dias (última leitura 07/06/2022)
- Makino-L2-Unit1-2015 sem enviar dados há 14 dias (última leitura 19/06/2022)
- Makino-L3-Unit1-2015 abaixo da meta de disponibilidade (86,3% contra 90,0%)
- Makino-L2-Unit1-2015 abaixo da meta de disponibilidade (87,2% contra 90,0%)
- Makino-L1-Unit1-2013 abaixo da meta de disponibilidade (85,5% contra 90,0%)

## 2. Disponibilidade (pilar do OEE que o dataset permite medir)
- Makino-L1-Unit1-2013: 85,5% · tempo médio entre falhas 7,5 h
- Makino-L2-Unit1-2015: 87,2% · tempo médio entre falhas 8,4 h
- Makino-L3-Unit1-2015: 86,3% · tempo médio entre falhas 7,9 h
- Tendência (2022-04 → 2022-05): taxa de falha 53,1% → 43,1% (melhorou)
- Desempenho e qualidade: **não medidos** (faltam produção prevista, produção real e peças boas). Ver o plano de coleta no README.

## 3. Risco em R$ (chance de falha x custo da falha)
- Modelo treinado com 2500 registros (dados até 03/07/2022). Último teste (30% mais recentes, 750 registros que ele não tinha visto): acerto de 89,9%; chutar sempre a mesma resposta acertaria 51,5%.
- 1º Makino-L3-Unit1-2015: chance de falha hoje 53,3%, risco de **R$ 658 por dia**
- 2º Makino-L2-Unit1-2015: chance de falha hoje 52,1%, risco de **R$ 621 por dia**
- 3º Makino-L1-Unit1-2013: chance de falha hoje 41,9%, risco de **R$ 533 por dia**
- Sensores que mais pesam: Pressão hidráulica (bar), Força de corte (kN), Torque (Nm).

## Falhas por área (premissa: área do sensor que mais pesou em cada falha)
- Mecânica: 699 falhas (55,3%), R$ 143.269
- Operacional: 534 falhas (42,2%), R$ 109.450
- Automação: 31 falhas (2,5%), R$ 6.354
- Elétrica: 1 falhas (0,1%), R$ 205

## 4. Preditiva x corretiva
- Esperar quebrar: R$ 35.551 por mês. Com preditiva (-50% de paradas): economia de **R$ 17.776 por mês**.
- Um programa de preditiva que custe até R$ 17.776 por mês já se paga.

## 5. Plano de ação
- Ver [plano_5w2h.md](plano_5w2h.md).

## Mensagem da semana (WhatsApp)

```
*Painel do Gestor · semana até 03/07/2022*
Falhas na semana: 1 · custo estimado: R$ 205
Atenção: Makino-L3-Unit1-2015 sem enviar dados há 26 dias (última leitura 07/06/2022)
Atenção: Makino-L2-Unit1-2015 sem enviar dados há 14 dias (última leitura 19/06/2022)
Área que mais gera falhas: Mecânica (55,3%)
Máquina em maior risco: Makino-L3-Unit1-2015 (53,3% de chance, R$ 658 por dia)
Ação da semana: Revisar bomba, filtros e vazamentos do sistema hidráulico (Técnico de manutenção hidráulica)
Com manutenção preditiva, a economia estimada é de R$ 17.776 por mês.
```
