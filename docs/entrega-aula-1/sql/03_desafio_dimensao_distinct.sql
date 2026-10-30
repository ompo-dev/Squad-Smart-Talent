-- GRUPO 4 | DESAFIO OPCIONAL DO ENUNCIADO
-- Dialeto: SQLite 3. Executar depois de importar o CSV e criar telemetria_limpa.
-- Demonstra CREATE TABLE AS SELECT DISTINCT e JOIN de volta com a tabela limpa.
-- A tabela temporaria serve para demonstrar a tecnica; a dimensao oficial
-- dim_maquina (com chave primaria declarada) e criada em 01_modelo_sqlite.sql.
-- No importador Python a etapa equivalente ocorre ANTES de popular a dimensao.

DROP TABLE IF EXISTS temp.maquinas_distintas_desafio;
CREATE TEMP TABLE maquinas_distintas_desafio AS
SELECT DISTINCT id_maquina
FROM telemetria_limpa
WHERE id_maquina IS NOT NULL;

SELECT
    d.id_maquina,
    COUNT(t.id_leitura) AS quantidade_leituras,
    ROUND(AVG(t.temp_motor_c), 1) AS temperatura_media_c,
    ROUND(MAX(t.horas_motor), 1) AS horas_motor_atual
FROM maquinas_distintas_desafio AS d
LEFT JOIN telemetria_limpa AS t
    ON t.id_maquina = d.id_maquina
GROUP BY d.id_maquina
ORDER BY quantidade_leituras DESC, d.id_maquina;

-- INTERPRETACAO: a tabela de dimensao deduplicada permite resumir cada
-- equipamento em uma so linha, sem perder as suas muitas leituras.
