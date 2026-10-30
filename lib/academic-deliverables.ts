/**
 * Entregáveis acadêmicos oficiais do tema: Manufatura e Eficiência (OEE)
 * Smart Talent John Deere · Remoto 01 · Aula 1
 */

export interface SqlQueryItem {
  numero: number
  tecnica: string
  pergunta: string
  sql: string
  interpretacao: string
  resultado_csv: string
}

export const THEME_NAME = "Manufatura e Eficiência (OEE)"

export const THEME_SQL_QUERIES: SqlQueryItem[] = [
  {
    numero: 1,
    tecnica: "Filtro e ordenação (WHERE e ORDER BY)",
    pergunta: "Quais são as 10 leituras com ocorrências mais graves?",
    sql: `SELECT
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
LIMIT 10;`,
    interpretacao: "As primeiras linhas concentram mais alertas simultâneos e condições de sensor que merecem análise prioritária.",
    resultado_csv: "Leitura 4238 (máquina 7), 05/05/2026 06:30, 104,1 °C, superaquecimento + leitura incompleta (pressão ausente), somando 2 alertas."
  },
  {
    numero: 2,
    tecnica: "Agregação e GROUP BY",
    pergunta: "Qual turno concentra mais alertas e leituras incompletas?",
    sql: `SELECT
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
ORDER BY ocorrencias_por_100_leituras DESC, turno;`,
    interpretacao: "Os turnos no topo apresentam mais ocorrências por 100 leituras, permitindo comparações mesmo com volumes diferentes.",
    resultado_csv: "Turno A lidera alertas de sensor (0,96 por 100 leituras); Turno C tem maior percentual de leituras incompletas (7,29%)."
  },
  {
    numero: 3,
    tecnica: "JOIN (dimensão com fato)",
    pergunta: "Quais máquinas e faixas de uso concentram cada tipo de ocorrência?",
    sql: `SELECT
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
ORDER BY total_ocorrencias DESC, d.id_maquina;`,
    interpretacao: "O cruzamento identifica as máquinas e as faixas de uso com maior concentração de alertas, incluindo máquinas sem ocorrência.",
    resultado_csv: "Máquinas 5 e 21 empatadas com 18 ocorrências cada; 24 máquinas mantidas na dimensão."
  },
  {
    numero: 4,
    tecnica: "HAVING e subconsulta",
    pergunta: "Quais máquinas registraram mais alertas por leitura do que a média da frota?",
    sql: `SELECT
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
ORDER BY ocorrencias_por_100_leituras DESC, id_maquina;`,
    interpretacao: "As máquinas apresentadas possuem frequência de alertas por leitura superior à média ponderada das leituras de toda a frota.",
    resultado_csv: "6 máquinas acima da média; máquina 5 lidera com 3,35 alertas por 100 leituras contra 0,68 da frota."
  },
  {
    numero: 5,
    tecnica: "Livre (Pergunta do Gestor)",
    pergunta: "Quais máquinas devo priorizar para manutenção e a condição delas está piorando ou melhorando?",
    sql: `WITH periodo AS (
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
ORDER BY pontos_prioridade DESC, alertas_por_100_leituras DESC, id_maquina;`,
    interpretacao: "O ranking usa quatro critérios de risco e compara a frequência de alertas entre as semanas de 01–07/05 e 08–14/05/2026 para indicar prioridade e tendência.",
    resultado_csv: "Máquina 22 em primeiro no ranking de manutenção (4/4 pontos de prioridade, tendência piorando)."
  }
]

export const THEME_RELATIONAL_MODEL = {
  nome: "Modelo Relacional de Telemetria e OEE (Grupo 4)",
  entidades: [
    {
      tabela: "telemetria_suja",
      papel: "Staging / Dados Brutos",
      pk: "id_registro_bruto (INTEGER)",
      fks: [],
      descricao: "Preserva o CSV original na íntegra com 4.060 linhas para auditoria e conferência."
    },
    {
      tabela: "dim_maquina",
      papel: "Dimensão",
      pk: "id_maquina (TEXT)",
      fks: [],
      descricao: "Uma linha por equipamento (24 máquinas distintas), com faixa de uso ('Baixa','Média','Alta'), horas e consumo médio."
    },
    {
      tabela: "telemetria_limpa",
      papel: "Fato / Leituras Higienizadas",
      pk: "id_leitura (TEXT)",
      fks: ["id_maquina -> dim_maquina(id_maquina)"],
      descricao: "4.000 leituras válidas tipadas com turno A/B/C e flags de triagem (def_superaquecimento, def_pressao_baixa, def_vibracao_alta, perda_leitura)."
    },
    {
      tabela: "fato_ocorrencia",
      papel: "Fato Analítico de Alertas",
      pk: "id_ocorrencia (INTEGER)",
      fks: [
        "(id_leitura, id_maquina) -> telemetria_limpa(id_leitura, id_maquina)",
        "id_maquina -> dim_maquina(id_maquina)"
      ],
      descricao: "298 ocorrências atomizadas por tipo de alerta para cruzamento e relatórios."
    }
  ],
  relacionamentos: [
    "dim_maquina (1) --- (N) telemetria_limpa : Uma máquina possui muitas leituras",
    "telemetria_limpa (1) --- (0..N) fato_ocorrencia : Uma leitura pode gerar zero, um ou vários alertas",
    "dim_maquina (1) --- (0..N) fato_ocorrencia : Permite análise direta de ocorrências por máquina"
  ],
  mermaidDiagram: `erDiagram
    dim_maquina ||--o{ telemetria_limpa : "1:N (possui)"
    telemetria_limpa ||--o{ fato_ocorrencia : "1:0..N (gera)"
    dim_maquina ||--o{ fato_ocorrencia : "1:0..N (relaciona)"
    telemetria_suja ||--|| telemetria_limpa : "higieniza"

    dim_maquina {
        string id_maquina PK
        string faixa_uso
        float horas_motor_atual
        float consumo_medio_l_h
    }
    telemetria_limpa {
        string id_leitura PK
        string id_maquina FK
        datetime data_hora
        string turno
        float temp_motor_c
        float pressao_oleo_psi
        float rpm
        float vibracao_mm_s
        float consumo_l_h
        float horas_motor
        int def_superaquecimento
        int def_pressao_baixa
        int def_vibracao_alta
        int perda_leitura
    }
    fato_ocorrencia {
        int id_ocorrencia PK
        string id_leitura FK
        string id_maquina FK
        string tipo_ocorrencia
    }
    telemetria_suja {
        int id_registro_bruto PK
        string id_leitura
        string id_maquina
        string data_hora
        string temp_motor_c
        string pressao_oleo_psi
        string rpm
        string vibracao_mm_s
        string consumo_l_h
        string horas_motor
        string turno
    }`
}

export const SABADO2_CHECKLIST = {
  titulo: "Checklist de Preparação do Sábado 2",
  itens_obrigatorios: [
    {
      requisito: "Conta GitHub + 2FA",
      criterio: "Conta verificada e autenticação de dois fatores ligada",
      situacao: "Confirmado (Maicon Pereira Barbosa / repositório ompo-dev/Squad-Smart-Talent)",
      responsavel: "Maicon Pereira Barbosa"
    },
    {
      requisito: "Docker Desktop",
      criterio: "Instalação e execução bem-sucedida de docker run hello-world",
      situacao: "Comprovado com sucesso (docker run hello-world + containers do TelemetryOS ativos)",
      responsavel: "Maicon Pereira Barbosa"
    },
    {
      requisito: "EADs (Python e Git/GitHub)",
      criterio: "Cursos concluídos na plataforma",
      situacao: "Em andamento / verificação pessoal",
      responsavel: "Integrantes do grupo"
    },
    {
      requisito: "Board do Sábado 2",
      criterio: "Cada tarefa com um integrante identificado",
      situacao: "Cartões [S2] mapeados",
      responsavel: "A definir por integrante"
    }
  ],
  cartoes_s2: [
    "[S2] Criar o GitHub com README e .gitignore",
    "[S2] Limpar o dataset com Pandas",
    "[S2] Fazer 2 gráficos",
    "[S2] Escrever o Dockerfile do pipeline",
    "[S2] Abrir 1 PR por integrante",
    "[S2] Preparar o ambiente: 2FA no GitHub, Docker hello-world, EADs"
  ]
}

export function getAcademicDelivery(topic: "all" | "sql_queries" | "relational_model" | "sabado2_checklist" = "all") {
  if (topic === "sql_queries") {
    return {
      tema: THEME_NAME,
      consultas: THEME_SQL_QUERIES,
      regras_avaliacao: "Sem SELECT *, dialeto SQLite 3, perguntas explícitas, 1 frase de interpretação por consulta."
    }
  }
  if (topic === "relational_model") {
    return {
      tema: THEME_NAME,
      modelo: THEME_RELATIONAL_MODEL
    }
  }
  if (topic === "sabado2_checklist") {
    return {
      tema: THEME_NAME,
      checklist: SABADO2_CHECKLIST
    }
  }
  return {
    tema: THEME_NAME,
    consultas: THEME_SQL_QUERIES,
    modelo: THEME_RELATIONAL_MODEL,
    checklist: SABADO2_CHECKLIST,
    arquivos_locais: "docs/entrega-aula-1/"
  }
}
