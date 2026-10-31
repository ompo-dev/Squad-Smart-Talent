# Interpretações reais · Machine Downtime

Fonte: `data/machine_downtime.csv` — 2.500 leituras, 3 máquinas (`Makino-L1/L2/L3`) e 3 linhas (`Shopfloor-L1/L2/L3`), de 24/11/2021 a 03/07/2022. Após a limpeza, 2.500 leituras permaneceram válidas, 154 células foram corrigidas (vazios, zeros, negativos ou fora da faixa) e 1.283 ocorrências críticas foram registradas no fato analítico.

1. **Leituras mais graves:** o topo da triagem combina parada (`downtime = 1`) com vibração da ferramenta acima de 44 µm ou pressão hidráulica fora da faixa de 40–185 bar. A leitura de 30/03/2022 da Makino-L1 acumula parada, vibração do spindle em 2,0 µm e pressão hidráulica em 72,19 bar; as duas primeiras condições são críticas para a triagem.
2. **Linhas de montagem:** a Shopfloor-L1 concentra 874 leituras e 454 paradas (51,95%), seguida pela Shopfloor-L3 com 818 leituras e 415 paradas (50,73%) e pela Shopfloor-L2 com 808 leituras e 396 paradas (49,01%). A taxa da frota é 50,6%.
3. **Máquinas e ocorrências:** a Makino-L1 tem o maior volume de leituras (874) e de ocorrências (458), incluindo 3 vibrações críticas e 1 pressão crítica. A Makino-L3 registra 422 ocorrências e a Makino-L2, 403. A dimensão mantém as 3 máquinas, mesmo as que não tenham ocorrência de um tipo específico.
4. **Acima da média da frota:** apenas Makino-L1 (51,95%) e Makino-L3 (50,73%) superam a taxa média de parada de 50,6%; a Makino-L2 fica ligeiramente abaixo, com 49,01%.
5. **Prioridade de manutenção:** Makino-L1 e Makino-L2 somam 3 de 4 critérios e recebem prioridade alta; a Makino-L3 soma 2 critérios e recebe prioridade média. As três máquinas mostram tendência de piora na segunda metade do período. A Makino-L2 chama atenção pela temperatura máxima de 98,2 °C em uma leitura isolada, sinalizada como outlier e mantida para investigação.

Os CSVs em `resultados/` são gerados por `scripts/executar_consultas.py` a partir de `dados/grupo4_machine_downtime.db`.
