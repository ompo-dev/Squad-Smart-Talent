-- Machine Downtime · Grupo 4
-- Cinco consultas SQLite sem SELECT *.
-- Execute após preparar_banco.py gerar grupo4_machine_downtime.db.

-- 1. Filtro e ordenação: leituras com mais critérios críticos simultâneos.
SELECT
    record_key,
    machine_id,
    assembly_line,
    date,
    coolant_temperature_c,
    spindle_bearing_temperature_c,
    spindle_vibration_um,
    tool_vibration_um,
    hydraulic_pressure_bar,
    downtime,
    (def_parada + def_temperatura_critica + def_vibracao_critica + def_pressao_critica) AS alertas_simultaneos
FROM telemetria_limpa
WHERE (def_parada + def_temperatura_critica + def_vibracao_critica + def_pressao_critica) > 0
ORDER BY alertas_simultaneos DESC,
         coolant_temperature_c DESC NULLS LAST,
         spindle_vibration_um DESC NULLS LAST,
         date DESC
LIMIT 10;

-- 2. Agregação e GROUP BY: comparar as linhas de montagem.
SELECT
    assembly_line,
    COUNT(*) AS leituras,
    SUM(downtime) AS paradas,
    ROUND(100.0 * SUM(downtime) / NULLIF(COUNT(*), 0), 2) AS taxa_parada_pct,
    ROUND(AVG(coolant_temperature_c), 2) AS temperatura_refrigerante_media_c,
    ROUND(MAX(coolant_temperature_c), 2) AS temperatura_refrigerante_maxima_c,
    ROUND(AVG(spindle_vibration_um), 3) AS vibracao_spindle_media_um,
    SUM(perda_leitura) AS leituras_incompletas,
    ROUND(100.0 * SUM(perda_leitura) / NULLIF(COUNT(*), 0), 2) AS pct_leituras_incompletas
FROM telemetria_limpa
GROUP BY assembly_line
ORDER BY taxa_parada_pct DESC, assembly_line;

-- 3. JOIN entre dimensão e fato de ocorrências.
SELECT
    d.machine_id,
    d.assembly_line,
    d.leituras,
    d.paradas,
    SUM(CASE WHEN f.tipo_ocorrencia = 'Parada' THEN 1 ELSE 0 END) AS paradas_registradas,
    SUM(CASE WHEN f.tipo_ocorrencia = 'Temperatura crítica' THEN 1 ELSE 0 END) AS temperaturas_criticas,
    SUM(CASE WHEN f.tipo_ocorrencia = 'Vibração crítica' THEN 1 ELSE 0 END) AS vibracoes_criticas,
    SUM(CASE WHEN f.tipo_ocorrencia = 'Pressão crítica' THEN 1 ELSE 0 END) AS pressoes_criticas,
    COUNT(f.id_ocorrencia) AS total_ocorrencias
FROM dim_maquina AS d
LEFT JOIN fato_ocorrencia AS f
    ON f.machine_id = d.machine_id
GROUP BY d.machine_id, d.assembly_line, d.leituras, d.paradas
ORDER BY total_ocorrencias DESC, d.machine_id;

-- 4. HAVING e subconsulta: máquinas acima da taxa de parada da frota.
SELECT
    machine_id,
    COUNT(*) AS leituras,
    SUM(downtime) AS paradas,
    ROUND(100.0 * AVG(downtime), 2) AS taxa_parada_pct,
    (SELECT ROUND(100.0 * AVG(downtime), 2) FROM telemetria_limpa) AS media_frota_pct
FROM telemetria_limpa
GROUP BY machine_id
HAVING AVG(downtime) > (SELECT AVG(downtime) FROM telemetria_limpa)
ORDER BY taxa_parada_pct DESC, machine_id;

-- 5. Pergunta do gestor: prioridade de manutenção e tendência entre os períodos.
WITH periodo AS (
    SELECT machine_id, date, coolant_temperature_c, perda_leitura,
           (def_parada + def_temperatura_critica + def_vibracao_critica + def_pressao_critica) AS alertas_criticos
    FROM telemetria_limpa
),
por_maquina AS (
    SELECT
        machine_id,
        COUNT(*) AS leituras,
        SUM(alertas_criticos) AS alertas_criticos,
        AVG(1.0 * alertas_criticos) AS taxa_alerta,
        AVG(1.0 * perda_leitura) AS taxa_incompleta,
        MAX(coolant_temperature_c) AS temperatura_maxima,
        SUM(CASE WHEN date < '2022-03-26' THEN 1 ELSE 0 END) AS leituras_sem1,
        SUM(CASE WHEN date >= '2022-03-26' THEN 1 ELSE 0 END) AS leituras_sem2,
        AVG(CASE WHEN date < '2022-03-26' THEN 1.0 * alertas_criticos END) AS taxa_sem1,
        AVG(CASE WHEN date >= '2022-03-26' THEN 1.0 * alertas_criticos END) AS taxa_sem2
    FROM periodo
    GROUP BY machine_id
),
media_frota AS (
    SELECT AVG(1.0 * alertas_criticos) AS taxa_alerta_frota,
           AVG(1.0 * perda_leitura) AS taxa_incompleta_frota
    FROM periodo
),
criterios AS (
    SELECT
        p.machine_id, p.leituras, p.alertas_criticos, p.taxa_alerta,
        p.taxa_incompleta, p.temperatura_maxima, p.taxa_sem1, p.taxa_sem2,
        p.leituras_sem1, p.leituras_sem2,
        CASE WHEN p.taxa_alerta > m.taxa_alerta_frota THEN 1 ELSE 0 END AS c_alertas,
        CASE WHEN p.taxa_incompleta > m.taxa_incompleta_frota THEN 1 ELSE 0 END AS c_incompletas,
        CASE WHEN p.temperatura_maxima >= 45 THEN 1 ELSE 0 END AS c_temperatura,
        CASE WHEN p.leituras_sem1 > 0 AND p.leituras_sem2 > 0
                  AND p.taxa_sem2 > p.taxa_sem1 THEN 1 ELSE 0 END AS c_piora
    FROM por_maquina AS p
    CROSS JOIN media_frota AS m
),
pontuacao AS (
    SELECT
        machine_id, leituras, alertas_criticos, taxa_alerta, taxa_incompleta,
        temperatura_maxima, taxa_sem1, taxa_sem2, leituras_sem1, leituras_sem2,
        c_alertas, c_incompletas, c_temperatura, c_piora,
        (c_alertas + c_incompletas + c_temperatura + c_piora) AS pontos_prioridade
    FROM criterios
)
SELECT
    machine_id,
    pontos_prioridade,
    CASE WHEN pontos_prioridade >= 3 THEN 'Alta - inspecionar com urgência'
         WHEN pontos_prioridade = 2 THEN 'Média - agendar inspeção'
         ELSE 'Baixa - monitorar' END AS prioridade,
    leituras,
    alertas_criticos,
    ROUND(100.0 * taxa_alerta, 2) AS alertas_por_100_leituras,
    ROUND(100.0 * taxa_incompleta, 2) AS leituras_incompletas_pct,
    ROUND(temperatura_maxima, 1) AS temperatura_maxima_c,
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
ORDER BY pontos_prioridade DESC, alertas_por_100_leituras DESC, machine_id;
