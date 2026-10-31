/**
 * Entregáveis acadêmicos oficiais do tema: Manufatura e Eficiência (OEE)
 * Smart Talent John Deere · Remoto 01 · Aula 1
 *
 * Dataset: Machine Downtime.csv (2.500 leituras, 3 máquinas, 3 linhas).
 * As consultas usam o banco SQLite gerado por docs/entrega-aula-1/scripts/preparar_banco.py.
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
    pergunta: "Quais são as 10 leituras com mais critérios críticos simultâneos?",
    sql: `SELECT
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
LIMIT 10;`,
    interpretacao: "O topo combina parada com vibração da ferramenta acima de 44 µm ou pressão hidráulica fora de 40–185 bar; a leitura de 30/03/2022 da Makino-L1 acumula parada, vibração do spindle em 2,0 µm e pressão hidráulica em 72,19 bar.",
    resultado_csv: "docs/entrega-aula-1/resultados/resultado_consulta_1.csv"
  },
  {
    numero: 2,
    tecnica: "Agregação e GROUP BY",
    pergunta: "Qual linha de montagem concentra mais paradas e leituras incompletas?",
    sql: `SELECT
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
ORDER BY taxa_parada_pct DESC, assembly_line;`,
    interpretacao: "A Shopfloor-L1 lidera com 874 leituras e 454 paradas (51,95%), seguida por Shopfloor-L3 (50,73%) e Shopfloor-L2 (49,01%); a taxa da frota é 50,6%.",
    resultado_csv: "docs/entrega-aula-1/resultados/resultado_consulta_2.csv"
  },
  {
    numero: 3,
    tecnica: "JOIN (dimensão com fato)",
    pergunta: "Quais máquinas concentram cada tipo de ocorrência crítica?",
    sql: `SELECT
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
ORDER BY total_ocorrencias DESC, d.machine_id;`,
    interpretacao: "A Makino-L1 concentra 458 ocorrências (454 paradas, 3 vibrações críticas e 1 pressão crítica); Makino-L3 soma 422 e Makino-L2, 403. O LEFT JOIN mantém as 3 máquinas mesmo sem ocorrência de um tipo.",
    resultado_csv: "docs/entrega-aula-1/resultados/resultado_consulta_3.csv"
  },
  {
    numero: 4,
    tecnica: "HAVING e subconsulta",
    pergunta: "Quais máquinas têm taxa de parada acima da média da frota?",
    sql: `SELECT
    machine_id,
    COUNT(*) AS leituras,
    SUM(downtime) AS paradas,
    ROUND(100.0 * AVG(downtime), 2) AS taxa_parada_pct,
    (SELECT ROUND(100.0 * AVG(downtime), 2) FROM telemetria_limpa) AS media_frota_pct
FROM telemetria_limpa
GROUP BY machine_id
HAVING AVG(downtime) > (SELECT AVG(downtime) FROM telemetria_limpa)
ORDER BY taxa_parada_pct DESC, machine_id;`,
    interpretacao: "Somente Makino-L1 (51,95%) e Makino-L3 (50,73%) superam a taxa média de parada da frota (50,6%); Makino-L2 fica em 49,01%.",
    resultado_csv: "docs/entrega-aula-1/resultados/resultado_consulta_4.csv"
  },
  {
    numero: 5,
    tecnica: "Livre (Pergunta do Gestor)",
    pergunta: "Quais máquinas devo priorizar para manutenção e a condição delas está piorando ou melhorando?",
    sql: `WITH periodo AS (
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
ORDER BY pontos_prioridade DESC, alertas_por_100_leituras DESC, machine_id;`,
    interpretacao: "Makino-L1 e Makino-L2 somam 3/4 critérios e recebem prioridade alta; Makino-L3 soma 2/4. As três máquinas mostram tendência de piora; a Makino-L2 tem temperatura máxima de 98,2 °C em leitura isolada sinalizada como outlier.",
    resultado_csv: "docs/entrega-aula-1/resultados/resultado_consulta_5.csv"
  }
]

export const THEME_RELATIONAL_MODEL = {
  nome: "Modelo Relacional de Manutenção e OEE (Grupo 4)",
  entidades: [
    {
      tabela: "telemetria_suja",
      papel: "Staging / Dados Brutos",
      pk: "id_registro_bruto (INTEGER)",
      fks: [],
      descricao: "Preserva as 2.500 linhas do Machine Downtime.csv na íntegra, com cabeçalhos e células originais para auditoria."
    },
    {
      tabela: "dim_maquina",
      papel: "Dimensão",
      pk: "machine_id (TEXT)",
      fks: [],
      descricao: "Uma linha por equipamento (3 máquinas Makino), com linha de montagem, leituras, paradas, taxa de parada e médias."
    },
    {
      tabela: "telemetria_limpa",
      papel: "Fato / Leituras Higienizadas",
      pk: "record_key (TEXT, SHA-256)",
      fks: ["machine_id -> dim_maquina(machine_id)"],
      descricao: "2.500 leituras tipadas com 12 sensores, downtime booleano, rótulo original, quality_issues e flags de triagem (parada, temperatura, vibração e pressão críticas)."
    },
    {
      tabela: "fato_ocorrencia",
      papel: "Fato Analítico de Alertas",
      pk: "id_ocorrencia (INTEGER)",
      fks: [
        "record_key -> telemetria_limpa(record_key)",
        "machine_id -> dim_maquina(machine_id)"
      ],
      descricao: "1.283 ocorrências atomizadas por tipo (Parada, Temperatura crítica, Vibração crítica, Pressão crítica) para cruzamento e relatórios."
    }
  ],
  relacionamentos: [
    "dim_maquina (1) --- (N) telemetria_limpa : Uma máquina possui muitas leituras",
    "telemetria_limpa (1) --- (0..N) fato_ocorrencia : Uma leitura pode gerar zero, um ou vários alertas",
    "dim_maquina (1) --- (0..N) fato_ocorrencia : Permite análise direta de ocorrências por máquina",
    "telemetria_suja (1) --- (1) telemetria_limpa : Cada linha bruta válida gera uma leitura higienizada"
  ],
  mermaidDiagram: `erDiagram
    dim_maquina ||--o{ telemetria_limpa : "1:N (possui)"
    telemetria_limpa ||--o{ fato_ocorrencia : "1:0..N (gera)"
    dim_maquina ||--o{ fato_ocorrencia : "1:0..N (relaciona)"
    telemetria_suja ||--|| telemetria_limpa : "higieniza"

    dim_maquina {
        string machine_id PK
        string assembly_line
        int leituras
        int paradas
        float taxa_parada
        float temperatura_refrigerante_media_c
        float vibracao_spindle_media_um
    }
    telemetria_limpa {
        string record_key PK
        string machine_id FK
        string assembly_line
        datetime date
        float hydraulic_pressure_bar
        float coolant_pressure_bar
        float air_system_pressure_bar
        float coolant_temperature_c
        float hydraulic_oil_temperature_c
        float spindle_bearing_temperature_c
        float spindle_vibration_um
        float tool_vibration_um
        float spindle_speed_rpm
        float voltage_v
        float torque_nm
        float cutting_kn
        int downtime
        string downtime_label
        string quality_issues
    }
    fato_ocorrencia {
        int id_ocorrencia PK
        string record_key FK
        string machine_id FK
        string tipo_ocorrencia
    }
    telemetria_suja {
        int id_registro_bruto PK
        string date
        string machine_id
        string assembly_line
        string hydraulic_pressure_bar
        string coolant_temperature_c
        string spindle_vibration_um
        string downtime
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
    "[S2] Limpar o dataset Machine Downtime com Python",
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
