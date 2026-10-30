-- SMART TALENT JOHN DEERE | GRUPO 4 | 30/10/2026
-- TEMA: MANUFATURA E EFICIENCIA (OEE)
-- Dialeto: SQLite 3 / DB Browser for SQLite. Requer as tabelas do modelo.
-- IMPORTANTE: alertas de sensor NAO sao equivalentes aos fatores reais do OEE.
-- Cada consulta possui pergunta, tecnica, uma frase interpretativa e resultado do CSV fornecido.
-- COUNT(*) e permitido; SELECT * foi evitado.

-- [CONSULTA 1]
-- PERGUNTA: Quais são as 10 leituras com ocorrências mais graves?
-- TECNICA: WHERE + ORDER BY + LIMIT.
-- REGRA: mais tipos de alerta simultâneos primeiro; depois maior temperatura,
-- maior vibração e menor pressão. Critério é de TRIAGEM, não laudo técnico.
SELECT
    id_leitura,
    id_maquina,
    data_hora,
    turno,
    temp_motor_c,
    vibracao_mm_s,
    pressao_oleo_psi,
    def_superaquecimento,
    def_pressao_baixa,
    def_vibracao_alta,
    perda_leitura,
    (def_superaquecimento + def_pressao_baixa + def_vibracao_alta + perda_leitura) AS alertas_simultaneos
FROM telemetria_limpa
WHERE (def_superaquecimento + def_pressao_baixa + def_vibracao_alta + perda_leitura) > 0
ORDER BY alertas_simultaneos DESC,
         temp_motor_c DESC NULLS LAST,
         vibracao_mm_s DESC NULLS LAST,
         pressao_oleo_psi ASC NULLS LAST,
         data_hora DESC
LIMIT 10;
-- INTERPRETACAO: As primeiras linhas concentram mais alertas simultâneos e,
-- nos empates, apresentam condições de sensor que merecem análise prioritária.
-- RESULTADO DO CSV: leitura 4238 (máquina 7), 05/05/2026 06:30, 104,1 °C, superaquecimento + leitura incompleta (pressão ausente), somando 2 alertas.
-- [FIM CONSULTA 1]

-- [CONSULTA 2]
-- PERGUNTA: Qual turno concentra mais alertas e leituras incompletas?
-- TECNICA: agregação + GROUP BY.
-- OBS.: ocorrencias_por_100_leituras pode superar 100, pois uma leitura
-- pode gerar mais de um alerta. pct_leituras_com_alerta não supera 100.
SELECT
    turno,
    COUNT(*) AS leituras,
    SUM(def_superaquecimento) AS superaquecimentos,
    SUM(def_pressao_baixa) AS pressoes_baixas,
    SUM(def_vibracao_alta) AS vibracoes_altas,
    SUM(def_superaquecimento + def_pressao_baixa + def_vibracao_alta) AS total_alertas_sensor,
    ROUND(100.0 * SUM(def_superaquecimento + def_pressao_baixa + def_vibracao_alta)
          / NULLIF(COUNT(*), 0), 2) AS ocorrencias_por_100_leituras,
    SUM(CASE WHEN (def_superaquecimento + def_pressao_baixa + def_vibracao_alta) > 0
             THEN 1 ELSE 0 END) AS leituras_com_alerta,
    ROUND(100.0 * SUM(CASE WHEN (def_superaquecimento + def_pressao_baixa + def_vibracao_alta) > 0
                           THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS pct_leituras_com_alerta,
    SUM(perda_leitura) AS leituras_incompletas,
    ROUND(100.0 * SUM(perda_leitura) / NULLIF(COUNT(*), 0), 2) AS pct_leituras_incompletas,
    ROUND(AVG(temp_motor_c), 1) AS temperatura_media_c
FROM telemetria_limpa
GROUP BY turno
ORDER BY ocorrencias_por_100_leituras DESC, turno;
-- INTERPRETACAO: Os turnos no topo apresentam mais ocorrências de sensor a
-- cada 100 leituras, permitindo comparar o risco mesmo com volumes diferentes.
-- RESULTADO DO CSV: turno A lidera alertas de sensor (13 em 1.348 leituras; 0,96 por 100); turno C tem maior percentual de leituras incompletas (7,29%).
-- [FIM CONSULTA 2]

-- [CONSULTA 3]
-- PERGUNTA: Quais máquinas e faixas de uso concentram cada tipo de ocorrência?
-- TECNICA: JOIN com ON entre a dimensão e a tabela de fatos.
-- LEFT JOIN preserva máquinas sem ocorrência, que aparecem com total zero.
SELECT
    d.id_maquina,
    d.faixa_uso,
    d.horas_motor_atual,
    ROUND(d.consumo_medio_l_h, 2) AS consumo_medio_l_h,
    SUM(CASE WHEN f.tipo_ocorrencia = 'Superaquecimento' THEN 1 ELSE 0 END) AS superaquecimentos,
    SUM(CASE WHEN f.tipo_ocorrencia = 'Pressão baixa' THEN 1 ELSE 0 END) AS pressoes_baixas,
    SUM(CASE WHEN f.tipo_ocorrencia = 'Vibração alta' THEN 1 ELSE 0 END) AS vibracoes_altas,
    SUM(CASE WHEN f.tipo_ocorrencia = 'Perda de leitura' THEN 1 ELSE 0 END) AS leituras_incompletas,
    COUNT(f.id_ocorrencia) AS total_ocorrencias
FROM dim_maquina AS d
LEFT JOIN fato_ocorrencia AS f
    ON f.id_maquina = d.id_maquina
GROUP BY d.id_maquina, d.faixa_uso, d.horas_motor_atual, d.consumo_medio_l_h
ORDER BY total_ocorrencias DESC, d.id_maquina;
-- INTERPRETACAO: O cruzamento mostra a distribuição dos tipos de ocorrência
-- por máquina e ajuda a relacioná-los à faixa de uso dos equipamentos.
-- RESULTADO DO CSV: máquinas 5 e 21 empatam com 18 ocorrências; o JOIN mantém 24 máquinas, inclusive as sem alertas.
-- [FIM CONSULTA 3]

-- [CONSULTA 4]
-- PERGUNTA: Quais máquinas registraram mais alertas por leitura que a média da frota?
-- TECNICA: GROUP BY + HAVING + subconsulta.
-- OBS.: esta é uma TAXA DE OCORRÊNCIAS, não percentual de produtos defeituosos.
SELECT
    id_maquina,
    COUNT(*) AS leituras,
    SUM(def_superaquecimento + def_pressao_baixa + def_vibracao_alta) AS alertas_sensor,
    ROUND(100.0 * AVG(def_superaquecimento + def_pressao_baixa + def_vibracao_alta), 2)
        AS ocorrencias_por_100_leituras,
    (SELECT ROUND(100.0 * AVG(def_superaquecimento + def_pressao_baixa + def_vibracao_alta), 2)
       FROM telemetria_limpa) AS media_frota_por_100_leituras
FROM telemetria_limpa
GROUP BY id_maquina
HAVING AVG(def_superaquecimento + def_pressao_baixa + def_vibracao_alta) >
       (SELECT AVG(def_superaquecimento + def_pressao_baixa + def_vibracao_alta)
          FROM telemetria_limpa)
ORDER BY ocorrencias_por_100_leituras DESC, id_maquina;
-- INTERPRETACAO: As máquinas listadas apresentam frequência de alertas por
-- leitura superior à média ponderada de todas as leituras da frota.
-- RESULTADO DO CSV: 6 máquinas acima da média; máquina 5 lidera com 3,35 alertas por 100 leituras; média ponderada da frota é 0,68.
-- [FIM CONSULTA 4]

-- [CONSULTA 5]
-- PERGUNTA DO GESTOR: Quais máquinas devo priorizar para manutenção e a condição
-- delas está piorando ou melhorando entre 01–07/05 e 08–14/05/2026?
-- TECNICA LIVRE: CTEs, CROSS JOIN, agregação temporal e pontuação.
-- CRITERIOS (1 ponto cada): acima da média de alertas da frota;
-- acima da média de leituras incompletas; temp. máxima >=100 °C;
-- semana 2 com mais alertas por leitura que a semana 1.
-- LIMITACAO: só analisa 01/05/2026 a 14/05/2026. Exige dados nas duas
-- semanas para inferir tendência; caso contrário retorna "Sem comparação".
WITH periodo AS (
    SELECT id_maquina, data_hora, temp_motor_c, perda_leitura,
           (def_superaquecimento + def_pressao_baixa + def_vibracao_alta) AS alertas_sensor
    FROM telemetria_limpa
    WHERE data_hora >= '2026-05-01 00:00:00'
      AND data_hora <  '2026-05-15 00:00:00'
),
por_maquina AS (
    SELECT
        id_maquina,
        COUNT(*) AS leituras,
        SUM(alertas_sensor) AS alertas_sensor,
        AVG(1.0 * alertas_sensor) AS taxa_alerta,
        AVG(1.0 * perda_leitura) AS taxa_incompleta,
        MAX(temp_motor_c) AS temp_maxima,
        SUM(CASE WHEN data_hora < '2026-05-08 00:00:00' THEN 1 ELSE 0 END) AS leituras_sem1,
        SUM(CASE WHEN data_hora >= '2026-05-08 00:00:00' THEN 1 ELSE 0 END) AS leituras_sem2,
        AVG(CASE WHEN data_hora < '2026-05-08 00:00:00' THEN 1.0 * alertas_sensor END) AS taxa_sem1,
        AVG(CASE WHEN data_hora >= '2026-05-08 00:00:00' THEN 1.0 * alertas_sensor END) AS taxa_sem2
    FROM periodo
    GROUP BY id_maquina
),
media_frota AS (
    SELECT AVG(1.0 * alertas_sensor) AS taxa_alerta_frota,
           AVG(1.0 * perda_leitura) AS taxa_incompleta_frota
    FROM periodo
),
criterios AS (
    SELECT
        p.id_maquina, p.leituras, p.alertas_sensor, p.taxa_alerta,
        p.taxa_incompleta, p.temp_maxima, p.taxa_sem1, p.taxa_sem2,
        p.leituras_sem1, p.leituras_sem2,
        CASE WHEN p.taxa_alerta > m.taxa_alerta_frota THEN 1 ELSE 0 END AS c_alertas,
        CASE WHEN p.taxa_incompleta > m.taxa_incompleta_frota THEN 1 ELSE 0 END AS c_incompletas,
        CASE WHEN p.temp_maxima >= 100 THEN 1 ELSE 0 END AS c_temperatura,
        CASE WHEN p.leituras_sem1 > 0 AND p.leituras_sem2 > 0
                  AND p.taxa_sem2 > p.taxa_sem1 THEN 1 ELSE 0 END AS c_piora
    FROM por_maquina AS p
    CROSS JOIN media_frota AS m
),
pontuacao AS (
    SELECT
        id_maquina, leituras, alertas_sensor, taxa_alerta, taxa_incompleta,
        temp_maxima, taxa_sem1, taxa_sem2, leituras_sem1, leituras_sem2,
        c_alertas, c_incompletas, c_temperatura, c_piora,
        (c_alertas + c_incompletas + c_temperatura + c_piora) AS pontos_prioridade
    FROM criterios
)
SELECT
    id_maquina,
    pontos_prioridade,
    CASE WHEN pontos_prioridade >= 3 THEN 'Alta - inspecionar com urgência'
         WHEN pontos_prioridade = 2 THEN 'Média - agendar inspeção'
         ELSE 'Baixa - monitorar' END AS prioridade,
    leituras,
    alertas_sensor,
    ROUND(100.0 * taxa_alerta, 2) AS alertas_por_100_leituras,
    ROUND(100.0 * taxa_incompleta, 2) AS leituras_incompletas_pct,
    ROUND(temp_maxima, 1) AS temperatura_maxima_c,
    ROUND(100.0 * taxa_sem1, 2) AS alertas_por_100_sem1,
    ROUND(100.0 * taxa_sem2, 2) AS alertas_por_100_sem2,
    CASE WHEN leituras_sem1 = 0 OR leituras_sem2 = 0 THEN 'Sem comparação'
         WHEN taxa_sem2 > taxa_sem1 THEN 'Piorando'
         WHEN taxa_sem2 < taxa_sem1 THEN 'Melhorando'
         ELSE 'Estável' END AS tendencia,
    c_alertas AS acima_media_alertas,
    c_incompletas AS acima_media_incompletas,
    c_temperatura AS atingiu_temperatura_critica,
    c_piora AS taxa_em_alta
FROM pontuacao
ORDER BY pontos_prioridade DESC, alertas_por_100_leituras DESC, id_maquina;
-- INTERPRETACAO: O ranking prioriza as máquinas com mais critérios de risco
-- atendidos e distingue piora, melhora, estabilidade ou dados insuficientes.
-- RESULTADO DO CSV: máquina 22 (4 pontos, piorando), seguida por máquinas 9 e 11 (3 pontos cada). Triagem proposta, não ordem de parada de máquina.
-- [FIM CONSULTA 5]
