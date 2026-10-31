# Site generativo

Proposta do Grupo 4 (Tema 1 · OEE) para o TelemetryOS: em vez de um painel fixo, o site monta a tela de cada pessoa
com as informações que os cargos dela liberam. A própria empresa organiza os cargos em árvore por setor, e cada chefe
repassa para os de baixo informações, máquinas e tarefas, sempre só o que tem.

Esta pasta é documentação e protótipo: não altera o app, o banco nem a CI.

## Conteúdo

| Arquivo | O que é |
| --- | --- |
| [guia.html](guia.html) | Documento principal: como o site funciona, dados e falha real, premissas com fonte, as 31 informações (origem, conta e porquê), regras de cargos e tarefas, páginas geradas, copiloto sem alucinação e proposta de banco, API, telas e testes. |
| [simulador.html](simulador.html) | Protótipo no visual do app. Abra no navegador e use a barra amarela para ver o site como cada cargo. O estado fica só no navegador; "Voltar ao exemplo" restaura. |
| [memoria-de-calculo.html](memoria-de-calculo.html) | De onde veio cada número, passo a passo, e o que não foi possível verificar. |
| [calculos/](calculos/) | Programa em Python (numpy) que recebe lotes, recalcula tudo, reaprende o modelo de risco a cada 7 dias de dados novos e grava `resultados/painel.json`. Ver [calculos/README.md](calculos/README.md). |
| [referencia/](referencia/) | Código do simulador para servir de base: regras de cargos e tarefas, contas das informações, páginas geradas, gráficos e o catálogo `informacoes.json`. |

## Regras

1. Cada setor é uma árvore de cargos; o dono fica acima de todos.
2. Só dou o que tenho: um cargo só pode ter as informações e máquinas do cargo de cima.
3. Cada chefe só mexe nos cargos abaixo do seu.
4. Tirou de cima, sai de baixo: a perda desce a árvore inteira.
5. "Pode repassar" vem ligado; só o último nível fica sem.
6. Tarefas descem pela cadeia, só para cargos abaixo que veem a informação da tarefa; o caminho fica registrado.
7. A IA lê, nunca calcula: o copiloto recebe só o que a pessoa pode ver.

As contas dessas regras estão em `referencia/regras-cargos-e-tarefas.js` (`acesso`, `poder`, `limiteDe`, `cascata`, `destinos`)
e explicadas na seção 6 do guia.

## Como executar os cálculos

```bash
cd docs/site-generativo/calculos
python scripts/painel_gestor.py            # processa o dataset inteiro
python scripts/painel_gestor.py simular    # teste: 30 lotes semanais, sem perda nem duplicação
```

## Limites

- Os valores em R$ mostram o método: o dataset tem cerca de 50% de falhas e não tem a duração das paradas.
  Custo, horas paradas e disponibilidade aparecem como faixa (piso: no máximo uma parada por dia por máquina; teto: cada registro é uma parada).
- Premissas: R$ 189,78 por hora parada (GRV 2024), 1,08 h por parada e −50% com preditiva (Siemens 2024), meta de 90% de disponibilidade (Nakajima).
- Os nomes de setores e cargos são exemplos.
