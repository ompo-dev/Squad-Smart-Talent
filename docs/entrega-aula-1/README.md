# GRUPO 4 — ENTREGA FINAL | MANUFATURA E EFICIÊNCIA (OEE)

**Smart Talent John Deere · Remoto 01 · Aula 1 · Prazo: 30/10/2026 às 23h59**

---

## 📁 Estrutura Organizada do Projeto

O projeto foi organizado em pastas funcionais para facilitar a navegação, conferência e entrega:

```text
GRUPO_4_SMART_TALENT_ENTREGA_FINAL/
│
├── README.md                           # Índice principal e guia de navegação
│
├── 📂 docs/                            # Documentação, relatórios e modelo
│   ├── 00_LEIA_ME_PRIMEIRO.md          # Orientações detalhadas do projeto
│   ├── TEXTO_DE_ENTREGA.md             # Texto consolidado para envio no portal
│   ├── Relatorio_Grupo4_OEE.pdf        # Relatório com contexto, consultas, modelo e limites
│   ├── modelo_relacional.png           # Diagrama ER do banco de dados (PNG)
│   ├── modelo_relacional.pdf           # Diagrama ER em alta resolução (PDF)
│   ├── preparacao_sabado2.md           # Checklist de preparação (GitHub, Docker, EADs)
│   └── 04_resultados_com_csv_real.md   # Interpretação analítica dos resultados
│
├── 📂 sql/                             # Scripts SQL (SQLite 3)
│   ├── 01_modelo_sqlite.sql            # DDL das tabelas, chaves primárias e relacionamentos
│   ├── 02_cinco_consultas_SQLite.sql   # As 5 consultas obrigatórias comentadas
│   └── 03_desafio_dimensao_distinct.sql# Desafio adicional (SELECT DISTINCT + JOIN)
│
├── 📂 dados/                           # Bases de dados e validações
│   ├── machine_downtime.csv            # Dataset real bruto (2.500 registros)
│   ├── grupo4_machine_downtime.db      # Banco SQLite tratado e validado
│   └── 05_resumo_validacao.json        # Hashes SHA-256 e contagens de validação
│
├── 📂 scripts/                         # Scripts de automação em Python padrão
│   ├── preparar_banco.py               # Higienização do CSV e criação da base SQLite
│   └── executar_consultas.py           # Execução das 5 consultas e exportação dos relatórios
│
└── 📂 resultados/                      # Saídas geradas pelas consultas
    ├── resultado_consulta_1.csv        # Consulta 1 (Top 10 leituras críticas)
    ├── resultado_consulta_2.csv        # Consulta 2 (Análise por linha de montagem)
    ├── resultado_consulta_3.csv        # Consulta 3 (Máquinas e tipos de ocorrência)
    ├── resultado_consulta_4.csv        # Consulta 4 (Máquinas acima da média da frota)
    ├── resultado_consulta_5.csv        # Consulta 5 (Ranking de manutenção de máquinas)
    └── interpretacoes_reais.md         # Sumário textual dos resultados
```

---

## 🎯 Itens Centrais para a Entrega no Portal

1. **Consultas SQL:** [`sql/02_cinco_consultas_SQLite.sql`](sql/02_cinco_consultas_SQLite.sql) — cinco perguntas de negócio, cinco consultas SQLite (sem `SELECT *`) com interpretações contextuais.
2. **Modelo Relacional:** [`docs/modelo_relacional.png`](docs/modelo_relacional.png) (ou [`docs/modelo_relacional.pdf`](docs/modelo_relacional.pdf)) — diagrama com PKs, FKs e cardinalidades.
3. **Checklist Sábado 2:** [`docs/preparacao_sabado2.md`](docs/preparacao_sabado2.md) — checklist de ambiente e cartões [S2].
4. **Relatório & Texto de Envio:** [`docs/Relatorio_Grupo4_OEE.pdf`](docs/Relatorio_Grupo4_OEE.pdf) e [`docs/TEXTO_DE_ENTREGA.md`](docs/TEXTO_DE_ENTREGA.md).

---

## ⚡ Como Executar os Scripts

Não é necessário instalar nenhuma biblioteca externa (utiliza apenas Python standard library):

### 1. Executar as consultas e exportar CSVs:
```bash
python scripts/executar_consultas.py
```
*(Lê automaticamente `dados/grupo4_machine_downtime.db` e salva em `resultados/`)*

### 2. Recriar o banco a partir do CSV bruto:
```bash
python scripts/preparar_banco.py ../data/machine_downtime.csv dados/grupo4_machine_downtime.db
```
*(Gera um novo banco aplicando a limpeza de datas, números, sentinelas e faixas físicas)*
