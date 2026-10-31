-- Desafio de dimensão DISTINCT
-- 1) Quais máquinas aparecem no dataset?
SELECT DISTINCT machine_id
FROM telemetria_limpa
ORDER BY machine_id;

-- 2) Quantas leituras e paradas cada máquina possui?
SELECT
    d.machine_id,
    d.assembly_line,
    COUNT(t.record_key) AS quantidade_leituras,
    SUM(t.downtime) AS paradas,
    ROUND(100.0 * AVG(t.downtime), 2) AS taxa_parada_pct,
    ROUND(AVG(t.coolant_temperature_c), 2) AS temperatura_refrigerante_media_c,
    ROUND(AVG(t.spindle_vibration_um), 3) AS vibracao_spindle_media_um
FROM dim_maquina AS d
LEFT JOIN telemetria_limpa AS t
    ON t.machine_id = d.machine_id
GROUP BY d.machine_id, d.assembly_line
ORDER BY quantidade_leituras DESC, d.machine_id;
