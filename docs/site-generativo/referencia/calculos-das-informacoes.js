const MESES = 7.293, CF = 1.08 * 189.78;
const D = {
  all: {registros:2500,falhas:1265,taxa:.506,dias_falha:354,horas_teto:1366.2,horas_piso:382.3,custo_teto:259277,custo_piso:72557,disp_teto:.8632,disp_piso:.9617,horas_possiveis:9984,mtbf:7.9,taxa_abr:.531,taxa_mai:.431,reg_abr:527,reg_mai:116,reincid:202,reincid_max:12,conf:1186,duv:68,erro:11,cut:[3.06,2.5],tq:[22.76,27.78],rpm:[21319,19200],ct_alta:40,v_std:45.4,hp_fora:465},
  L1: {registros:874,falhas:454,taxa:.5195,dias_falha:126,horas_teto:490.3,horas_piso:136.1,custo_teto:93053,custo_piso:25825,disp_teto:.8551,disp_piso:.9598,horas_possiveis:3384,mtbf:7.5,taxa_abr:.567,taxa_mai:.39,reg_abr:194,reg_mai:41,reincid:70,reincid_max:12,conf:428,duv:22,erro:4,cut:[3.04,2.48],tq:[22.59,27.5],rpm:[21446,19180],ct_alta:15,v_std:45.9,hp_fora:157},
  L2: {registros:808,falhas:396,taxa:.4901,dias_falha:114,horas_teto:427.7,horas_piso:123.1,custo_teto:81165,custo_piso:23366,disp_teto:.8718,disp_piso:.9631,horas_possiveis:3336,mtbf:8.4,taxa_abr:.497,taxa_mai:.465,reg_abr:175,reg_mai:43,reincid:66,reincid_max:12,conf:371,duv:23,erro:2,cut:[3.08,2.52],tq:[22.62,27.71],rpm:[21362,19239],ct_alta:11,v_std:45.3,hp_fora:153},
  L3: {registros:818,falhas:415,taxa:.5073,dias_falha:114,horas_teto:448.2,horas_piso:123.1,custo_teto:85059,custo_piso:23366,disp_teto:.8627,disp_piso:.9623,horas_possiveis:3264,mtbf:7.9,taxa_abr:.525,taxa_mai:.438,reg_abr:158,reg_mai:32,reincid:66,reincid_max:10,conf:387,duv:23,erro:5,cut:[3.05,2.5],tq:[23.09,28.13],rpm:[21140,19181],ct_alta:14,v_std:44.9,hp_fora:155}
};
const M = {
  L1: {nome:'Makino-L1', chance:.419, rpd:874/141, risco:532.82, saude:58, prox:9.2, hp:13, corte:11, torque:13, alto:8, areas:[244,199,11,0], semdados:0, ultima:'03/07/2022'},
  L2: {nome:'Makino-L2', chance:.521, rpd:808/139, risco:620.7, saude:48, prox:7.9, hp:18, corte:15, torque:12, alto:13, areas:[216,171,9,0], semdados:14, ultima:'19/06/2022'},
  L3: {nome:'Makino-L3', chance:.533, rpd:818/136, risco:657.6, saude:47, prox:7.5, hp:22, corte:12, torque:11, alto:13, areas:[239,164,11,1], semdados:26, ultima:'07/06/2022'}
};
const ORDEM = ['L3', 'L2', 'L1'];
const ESCOPO = {all:'Todas as máquinas', L1:'Só a Makino-L1', L2:'Só a Makino-L2', L3:'Só a Makino-L3', 'L1+L2':'Makino-L1 e L2', 'L1+L3':'Makino-L1 e L3', 'L2+L3':'Makino-L2 e L3'};

const fmt = (v, c = 0) => v.toLocaleString('pt-BR', {minimumFractionDigits: c, maximumFractionDigits: c});
const brl = v => 'R$ ' + fmt(v);
const pct = (v, c = 1) => fmt(v * 100, c) + '%';
const faixa = s => (s.saude < 50 ? 'crítica' : s.saude < 70 ? 'atenção' : 'boa');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const maqs = e => (e === 'all' ? ORDEM : ORDEM.filter(k => e.split('+').includes(k)));
// Chave do escopo a partir de uma lista de máquinas: 'all', 'L3' ou 'L1+L3'
const chaveEscopo = lista => { const l = ['L1', 'L2', 'L3'].filter(k => lista.includes(k)); return l.length === 3 ? 'all' : l.join('+'); };
// Escopo com 2 máquinas: soma as contagens das duas e recalcula taxas e médias
[['L1', 'L2'], ['L1', 'L3'], ['L2', 'L3']].forEach(par => {
  const [a, b] = par.map(k => D[k]), soma = c => a[c] + b[c], media = c => [0, 1].map(i => (a[c][i] * a.registros + b[c][i] * b.registros) / (a.registros + b.registros));
  const d = {registros: soma('registros'), falhas: soma('falhas'), dias_falha: soma('dias_falha'), horas_teto: soma('horas_teto'), horas_piso: soma('horas_piso'),
    custo_teto: soma('custo_teto'), custo_piso: soma('custo_piso'), horas_possiveis: soma('horas_possiveis'), reg_abr: soma('reg_abr'), reg_mai: soma('reg_mai'),
    reincid: soma('reincid'), reincid_max: Math.max(a.reincid_max, b.reincid_max), conf: soma('conf'), duv: soma('duv'), erro: soma('erro'),
    cut: media('cut'), tq: media('tq'), rpm: media('rpm'), ct_alta: soma('ct_alta'), v_std: (a.v_std + b.v_std) / 2, hp_fora: soma('hp_fora')};
  d.taxa = d.falhas / d.registros; d.disp_teto = 1 - d.horas_teto / d.horas_possiveis; d.disp_piso = 1 - d.horas_piso / d.horas_possiveis; d.mtbf = d.horas_possiveis / d.falhas;
  d.taxa_abr = (a.taxa_abr * a.reg_abr + b.taxa_abr * b.reg_abr) / d.reg_abr; d.taxa_mai = (a.taxa_mai * a.reg_mai + b.taxa_mai * b.reg_mai) / d.reg_mai;
  D[par.join('+')] = d;
});

const PACOTES = [
  {id:'fin', nome:'Financeiro'}, {id:'op', nome:'Operação'}, {id:'prev', nome:'Previsão'}, {id:'man', nome:'Manutenção'},
  {id:'proc', nome:'Processo e ferramenta'}, {id:'sup', nome:'Suprimentos'}, {id:'seg', nome:'Segurança'}, {id:'ges', nome:'Gestão de ações'}
];

// Cada informação: de onde vem, a conta, o porquê e o valor para o escopo da pessoa (todas as máquinas ou uma)
const ITENS = [
  {id:'fin_custo', pac:'fin', nome:'Custo das paradas por mês', st:'prem',
   origem:'Coluna "falhou / não falhou", data e máquina. Premissas: 1,08 h por parada (Siemens 2024) e R$ 189,78 por hora parada (custo de reposição, pesquisa GRV 2024 com 480 empresas).',
   conta:'Teto = registros de falha × 1,08 h × R$ 189,78 ÷ meses. Piso = dias com falha × 1,08 h × R$ 189,78 ÷ meses.',
   porque:'Mostra o tamanho do problema em reais. É faixa porque o dataset não diz se várias falhas no mesmo dia são uma parada só.',
   val: e => { const d = D[e]; return {v:`${brl(d.custo_piso / MESES)} a ${brl(d.custo_teto / MESES)}`, sub:'por mês, período de 7,3 meses',
     n:`Teto: ${fmt(d.falhas)} × 1,08 h × R$ 189,78 = ${brl(d.custo_teto)} ÷ 7,3 = ${brl(d.custo_teto / MESES)}. Piso: ${fmt(d.dias_falha)} dias com falha × 1,08 h × R$ 189,78 = ${brl(d.custo_piso)} ÷ 7,3 = ${brl(d.custo_piso / MESES)}.`}; }},
  {id:'fin_parada', pac:'fin', nome:'Custo por parada', st:'prem',
   origem:'Só as premissas: 1,08 h por parada (Siemens 2024) e R$ 189,78 por hora (GRV 2024).',
   conta:'Duração média de uma parada × custo de uma hora parada.',
   porque:'É a base de todas as contas em reais e o número mais fácil de comunicar.',
   val: () => ({v:'R$ 204,96', sub:'cada vez que uma máquina para', n:'1,08 h × R$ 189,78 = R$ 204,96'})},
  {id:'fin_risco', pac:'fin', nome:'Risco em R$ por dia', st:'prem',
   origem:'Chance de falha prevista pelo modelo (12 sensores), número de registros por dia de cada máquina e o custo por parada.',
   conta:'Chance de falha recente × registros por dia × R$ 204,96.',
   porque:'Transforma o risco em dinheiro e diz onde agir primeiro.',
   val: e => { const ms = maqs(e), t = ms.reduce((a, k) => a + M[k].risco, 0), k = ms[0];
     return {v:brl(t) + '/dia', sub: ms.length > 1 ? ms.map(k => `${M[k].nome} ${brl(M[k].risco)}`).join(' · ') : M[k].nome,
       n:`${M[k].nome}: ${pct(M[k].chance)} × ${fmt(M[k].rpd, 1)} registros por dia × R$ 204,96 = ${brl(M[k].risco)} por dia.`}; }},
  {id:'fin_economia', pac:'fin', nome:'Economia com manutenção preditiva', st:'prem',
   origem:'Custo das paradas e a premissa de 50% menos paradas com manutenção preditiva (Siemens 2024).',
   conta:'Custo das paradas por mês × 50%.',
   porque:'Mostra quanto dá para investir em prevenção e ainda ganhar.',
   val: e => { const d = D[e]; return {v:`${brl(d.custo_piso / MESES / 2)} a ${brl(d.custo_teto / MESES / 2)}`, sub:'por mês',
     n:`${brl(d.custo_piso / MESES)} × 50% = ${brl(d.custo_piso / MESES / 2)} · ${brl(d.custo_teto / MESES)} × 50% = ${brl(d.custo_teto / MESES / 2)}`}; }},

  {id:'op_falhas', pac:'op', nome:'Falhas e taxa de falha', st:'ok',
   origem:'Coluna "falhou / não falhou" de cada registro.',
   conta:'Contagem dos registros marcados como falha ÷ total de registros.',
   porque:'É a medida mais direta de quanto as máquinas param.',
   val: e => { const d = D[e]; return {v:`${fmt(d.falhas)} falhas`, sub:`${pct(d.taxa)} dos ${fmt(d.registros)} registros`, n:`${fmt(d.falhas)} ÷ ${fmt(d.registros)} = ${pct(d.taxa)}`}; }},
  {id:'op_qualidade', pac:'op', nome:'Falha real × sujeira', st:'ok',
   origem:'Coluna de falha conferida com os 12 sensores e com o modelo de risco.',
   conta:'Confirmada: marcada como falha e com pelo menos um sensor fora do normal (1% a 99% dos registros sem falha) ou o modelo reconhece. Duvidosa: marcada, mas nenhum sinal. Erro de dado: valor impossível ou 2 ou mais sensores vazios.',
   porque:'O dataset está sujo. Separar as falhas evita decidir em cima de anotação errada.',
   val: e => { const d = D[e]; return {v:`${fmt(d.conf)} confirmadas`, sub:`${d.duv} duvidosas · ${d.erro} com erro de dado`, n:`${fmt(d.conf)} + ${d.duv} + ${d.erro} = ${fmt(d.conf + d.duv + d.erro)} de ${fmt(d.falhas)} falhas`}; }},
  {id:'op_horas', pac:'op', nome:'Horas paradas', st:'prem',
   origem:'Falhas e a premissa de 1,08 h por parada (Siemens 2024).',
   conta:'Teto = registros de falha × 1,08 h. Piso = dias com falha × 1,08 h.',
   porque:'É o tempo em que a linha deixou de produzir.',
   val: e => { const d = D[e]; return {v:`${fmt(d.horas_piso)} a ${fmt(d.horas_teto)} h`, sub:'no período de 7,3 meses', n:`${fmt(d.dias_falha)} × 1,08 = ${fmt(d.horas_piso, 1)} h · ${fmt(d.falhas)} × 1,08 = ${fmt(d.horas_teto, 1)} h`}; }},
  {id:'op_disp', pac:'op', nome:'Disponibilidade (1º pilar do OEE)', st:'prem',
   origem:'Horas paradas e dias com registro de cada máquina. O dataset não tem turnos, então cada dia conta 24 h.',
   conta:'1 − horas paradas ÷ horas possíveis. Horas possíveis = dias com registro × 24 h.',
   porque:'É a parte do OEE que os dados permitem medir. Meta de classe mundial: 90% (Nakajima).',
   val: e => { const d = D[e]; return {v:`${pct(d.disp_teto)} a ${pct(d.disp_piso)}`, sub:'meta: 90%', n:`1 − ${fmt(d.horas_teto, 1)} ÷ ${fmt(d.horas_possiveis)} = ${pct(d.disp_teto)} · 1 − ${fmt(d.horas_piso, 1)} ÷ ${fmt(d.horas_possiveis)} = ${pct(d.disp_piso)}`}; }},
  {id:'op_tend', pac:'op', nome:'Tendência (abril → maio)', st:'ok',
   origem:'Falhas e registros de cada mês. Usa os dois últimos meses com pelo menos 50 registros.',
   conta:'Taxa de falha do mês contra a do mês anterior.',
   porque:'Mostra se a situação está melhorando ou piorando.',
   val: e => { const d = D[e]; return {v:`${pct(d.taxa_abr)} → ${pct(d.taxa_mai)}`, sub: d.taxa_mai < d.taxa_abr ? 'melhorou' : 'piorou', n:`Abril: ${d.reg_abr} registros · maio: ${d.reg_mai} registros`}; }},
  {id:'op_cap', pac:'op', nome:'Horas disponíveis para produzir', st:'prem',
   origem:'Horas possíveis e horas paradas.',
   conta:'Horas possíveis − horas paradas.',
   porque:'Ajuda o planejamento a saber quanto dá para produzir.',
   val: e => { const d = D[e]; return {v:`${fmt(d.horas_possiveis - d.horas_teto)} a ${fmt(d.horas_possiveis - d.horas_piso)} h`, sub:`de ${fmt(d.horas_possiveis)} h possíveis`, n:`${fmt(d.horas_possiveis)} − ${fmt(d.horas_teto, 1)} · ${fmt(d.horas_possiveis)} − ${fmt(d.horas_piso, 1)}`}; }},
  {id:'op_oee', pac:'op', nome:'OEE completo', st:'novo',
   origem:'Precisa de peças produzidas, peças planejadas e peças boas, que o dataset não tem.',
   conta:'Disponibilidade × desempenho × qualidade.',
   porque:'É o indicador do tema. Classe mundial: 85%.',
   val: () => ({v:'Não medido', sub:'falta o contador de peças e a inspeção de qualidade', n:'Hoje só a disponibilidade é medida.'})},

  {id:'prev_chance', pac:'prev', nome:'Chance de falha hoje', st:'ok',
   origem:'Os 12 sensores. Um modelo (regressão logística) aprende com o histórico quais leituras aparecem antes das falhas.',
   conta:'Média da chance prevista nos 30 registros mais recentes da máquina.',
   porque:'Responde à pergunta do professor: qual máquina vai parar?',
   val: e => { const ms = maqs(e); return {v:pct(M[ms[0]].chance), sub: ms.length > 1 ? ms.map(k => `${M[k].nome} ${pct(M[k].chance)}`).join(' · ') : M[ms[0]].nome, n:'O modelo acerta 89,9% em dados que não viu; chutar sempre a mesma resposta acerta 51,5%.'}; }},
  {id:'prev_saude', pac:'prev', nome:'Saúde da máquina (0 a 100)', st:'ok',
   origem:'Chance de falha recente.',
   conta:'100 − chance de falha. Abaixo de 50: crítica; de 50 a 70: atenção; acima de 70: boa.',
   porque:'Uma nota fácil de ler, sem precisar entender o modelo.',
   val: e => { const ms = maqs(e); return {v: ms.length > 1 ? ms.map(k => M[k].saude).join(' · ') : `${M[ms[0]].saude}/100`, sub: ms.map(k => `${M[k].nome}: ${faixa(M[k])}`).join(' · '), n: ms.map(k => `100 − ${fmt(M[k].chance * 100, 1)} = ${M[k].saude}`).join(' · ')}; }},
  {id:'prev_proxima', pac:'prev', nome:'Próxima falha estimada', st:'ok',
   origem:'Chance de falha recente e registros por dia de cada máquina.',
   conta:'Falhas esperadas por dia = chance × registros por dia. Próxima falha = 24 h ÷ falhas esperadas por dia.',
   porque:'Diz quando agir. É uma média, não um horário exato.',
   val: e => { const ms = maqs(e), k = ms[0], fd = M[k].chance * M[k].rpd;
     return {v:`~${fmt(M[k].prox, 1)} h`, sub: ms.length > 1 ? ms.map(k => `${M[k].nome} ~${fmt(M[k].prox, 1)} h`).join(' · ') : M[k].nome,
       n:`${M[k].nome}: ${pct(M[k].chance)} × ${fmt(M[k].rpd, 1)} = ${fmt(fd, 2)} falhas por dia · 24 ÷ ${fmt(fd, 2)} = ${fmt(24 / fd, 1)} h`}; }},
  {id:'prev_ranking', pac:'prev', nome:'Ranking de prioridade', st:'prem',
   origem:'Risco em R$ por dia de cada máquina.',
   conta:'Ordena as máquinas do maior para o menor risco em R$.',
   porque:'Diz o que atacar primeiro.',
   val: e => { const ms = maqs(e); return {v: ms.map(k => `${ORDEM.indexOf(k) + 1}º ${k}`).join(' · '), sub: ms.length > 1 ? 'na ordem do maior risco em R$' : `${M[ms[0]].nome}, entre as 3 máquinas`, n:'R$ 658 (L3) > R$ 621 (L2) > R$ 533 (L1) por dia'}; }},
  {id:'prev_modelo', pac:'prev', nome:'Confiabilidade do modelo', st:'ok',
   origem:'Teste do modelo em dados que ele não viu no treino.',
   conta:'Aprende com os 70% de registros mais antigos e é testado nos 30% mais recentes. Depois, a cada semana nova, é testado antes de reaprender.',
   porque:'Se o modelo não superar o chute, o painel avisa e o ranking não deve ser usado.',
   val: () => ({v:'89,9%', sub:'de acerto em dados novos · chute: 51,5%', n:'Teste semana a semana: 86,6% contra 58,9% do chute'})},

  {id:'man_alertas', pac:'man', nome:'Alertas de sensor', st:'ok',
   origem:'Últimos 30 registros de cada máquina.',
   conta:'Limite = meio entre a média do sensor nas falhas e a média normal. Pressão hidráulica abaixo de 101,7 bar · força de corte acima de 2,8 kN · torque abaixo de 25,3 Nm.',
   porque:'Avisa antes de quebrar.',
   val: e => { const ms = maqs(e), s = f => ms.reduce((a, k) => a + M[k][f], 0), n = ms.length * 30;
     return {v:`${s('hp')} de ${n}`, sub:`registros com pressão hidráulica baixa · corte alto: ${s('corte')} · torque baixo: ${s('torque')}`, n:'Hidráulica: (84,8 + 118,6) ÷ 2 = 101,7 bar'}; }},
  {id:'man_areas', pac:'man', nome:'Falhas por área', st:'prem',
   origem:'Pesos do modelo e a ligação de cada sensor a uma área (premissa do grupo). A área real viria das ordens de manutenção do SAP.',
   conta:'Em cada falha, o sensor que mais puxou a chance de falha define a área.',
   porque:'Manda o problema para a equipe certa.',
   val: e => { const a = maqs(e).reduce((t, k) => t.map((v, i) => v + M[k].areas[i]), [0, 0, 0, 0]), tot = a.reduce((x, y) => x + y, 0);
     return {v:`Mecânica ${pct(a[0] / tot, 0)}`, sub:`operacional ${pct(a[1] / tot, 0)} · automação ${pct(a[2] / tot, 1)} · elétrica ${pct(a[3] / tot, 1)}`, n:`${a[0]} + ${a[1]} + ${a[2]} + ${a[3]} = ${tot} falhas`}; }},
  {id:'man_mtbf', pac:'man', nome:'Tempo médio entre falhas (MTBF)', st:'prem',
   origem:'Horas possíveis e número de falhas.',
   conta:'Horas possíveis ÷ falhas.',
   porque:'Mede a confiabilidade da máquina. Quanto maior, melhor.',
   val: e => { const d = D[e]; return {v:`${fmt(d.mtbf, 1)} h`, sub:'contando cada registro como uma falha', n:`${fmt(d.horas_possiveis)} h ÷ ${fmt(d.falhas)} = ${fmt(d.horas_possiveis / d.falhas, 1)} h`}; }},
  {id:'man_reincid', pac:'man', nome:'Reincidência no mesmo dia', st:'ok',
   origem:'Falhas por máquina por dia.',
   conta:'Dias em que a mesma máquina teve 3 ou mais falhas.',
   porque:'Pode indicar conserto que não resolveu. Sem a hora, também pode ser a mesma parada anotada várias vezes.',
   val: e => { const d = D[e]; return {v:`${d.reincid} dias`, sub:`com 3 ou mais falhas · pior dia: ${d.reincid_max}`, n:`${d.reincid} de ${d.dias_falha} dias com falha`}; }},
  {id:'man_semdados', pac:'man', nome:'Máquina sem enviar dados', st:'ok',
   origem:'Data da última leitura de cada máquina.',
   conta:'Dias entre a última leitura da máquina e a leitura mais recente da frota. Alerta acima de 7 dias.',
   porque:'Sensor desligado ou conexão caída: sem dado, o painel fica cego.',
   val: e => { const ms = maqs(e), pior = ms.reduce((a, k) => (M[k].semdados > M[a].semdados ? k : a), ms[0]);
     return {v: M[pior].semdados ? `${M[pior].semdados} dias` : 'Em dia', sub: ms.map(k => `${M[k].nome}: ${M[k].semdados ? M[k].semdados + ' dias sem dados' : 'em dia'}`).join(' · '), n:`Última leitura de ${M[pior].nome}: ${M[pior].ultima} · frota: 03/07/2022`}; }},

  {id:'proc_ferr', pac:'proc', nome:'Desgaste da ferramenta', st:'prem',
   origem:'Força de corte e torque, comparando registros com e sem falha.',
   conta:'Média nas falhas contra média no funcionamento normal.',
   porque:'Força de corte subindo e torque caindo indicam ferramenta gasta: hora de trocar ou afiar.',
   val: e => { const d = D[e]; return {v:`${fmt(d.cut[1], 1)} → ${fmt(d.cut[0], 1)} kN`, sub:`força de corte nas falhas · torque ${fmt(d.tq[1], 1)} → ${fmt(d.tq[0], 1)} Nm`, n:'Normal → nas falhas'}; }},
  {id:'proc_rpm', pac:'proc', nome:'Rotação do fuso', st:'ok',
   origem:'Sensor de rotação, comparando registros com e sem falha.',
   conta:'Média nas falhas contra média no funcionamento normal.',
   porque:'Rotação acima do padrão pode indicar programa CNC mal ajustado.',
   val: e => { const d = D[e]; return {v:`${fmt(d.rpm[1] / 1000, 1)} → ${fmt(d.rpm[0] / 1000, 1)} mil RPM`, sub:'normal → nas falhas', n:`${fmt(d.rpm[1])} → ${fmt(d.rpm[0])} RPM`}; }},

  {id:'sup_pecas', pac:'sup', nome:'Peças com mais chance de serem necessárias', st:'prem',
   origem:'Alertas de sensor nos últimos 30 registros e a ligação de cada sensor a uma peça (premissa).',
   conta:'Hidráulica baixa → filtro e bomba hidráulica. Força de corte alta → inserto da ferramenta.',
   porque:'Comprar antes de faltar evita máquina parada esperando peça.',
   val: e => { const ms = maqs(e), s = f => ms.reduce((a, k) => a + M[k][f], 0), n = ms.length * 30;
     return {v:'Filtro e bomba hidráulica', sub:`${s('hp')} de ${n} registros com alerta hidráulico · inserto: ${s('corte')} de ${n}`, n:'Quanto mais alertas, maior a chance de precisar da peça'}; }},
  {id:'sup_estoque', pac:'sup', nome:'Estoque de peças críticas', st:'novo',
   origem:'Precisa do sistema de estoque da fábrica.',
   conta:'Peças em estoque contra peças prováveis.',
   porque:'Mostra se a peça vai estar lá quando precisar.',
   val: () => ({v:'Não medido', sub:'falta ligar ao estoque', n:'Dado novo'})},

  {id:'seg_hidr', pac:'seg', nome:'Risco de vazamento hidráulico', st:'prem',
   origem:'Sensor de pressão hidráulica.',
   conta:'Registros com pressão fora da faixa normal (de 70,5 a 169,3 bar, 1% a 99% dos registros sem falha).',
   porque:'Pressão anormal pode ser vazamento de óleo: risco de acidente e dano ambiental.',
   val: e => { const d = D[e]; return {v:`${d.hp_fora} registros`, sub:'com pressão hidráulica fora da faixa normal', n:`${d.hp_fora} de ${fmt(d.registros)} registros`}; }},
  {id:'seg_temp', pac:'seg', nome:'Temperatura do refrigerante alta', st:'ok',
   origem:'Sensor de temperatura do refrigerante.',
   conta:'Registros acima de 31,7 °C (99% dos registros sem falha ficam abaixo disso).',
   porque:'Superaquecimento pode causar dano à máquina e risco ao operador.',
   val: e => { const d = D[e]; return {v:`${d.ct_alta} registros`, sub:'acima de 31,7 °C', n:`${d.ct_alta} de ${fmt(d.registros)} registros`}; }},
  {id:'seg_tensao', pac:'seg', nome:'Oscilação de tensão', st:'ok',
   origem:'Sensor de tensão.',
   conta:'Desvio padrão da tensão: quanto ela varia em torno da média.',
   porque:'Tensão instável pode danificar motores e painéis elétricos.',
   val: e => { const d = D[e]; return {v:`± ${fmt(d.v_std)} V`, sub:'variação típica em torno da média (349 V)', n:'Desvio padrão de todas as leituras de tensão'}; }},

  {id:'ges_5w2h', pac:'ges', nome:'Plano de ação 5W2H', st:'ok',
   origem:'Os 3 sensores que mais pesam no modelo, com a ação e o responsável ligados a cada um.',
   conta:'O quê, por quê, onde, quando, quem, como e quanto, montados automaticamente.',
   porque:'Transforma análise em ação.',
   val: e => ({v:'3 ações', sub:`1. Revisar o sistema hidráulico (até 10/07) · 2. Trocar ou afiar a ferramenta (até 17/07) · 3. Conferir fixação e torque (até 24/07) · onde: começando pela ${M[maqs(e)[0]].nome}`, n:'Quanto: até R$ 5.925 por mês cada, o teto que se paga com a economia'})},
  {id:'ges_status', pac:'ges', nome:'Ações no prazo', st:'ok',
   origem:'Status de cada ação, marcado por quem executa.',
   conta:'Feitas, no prazo e atrasadas, contra o prazo de cada uma.',
   porque:'Cobra a entrega no prazo.',
   val: () => ({v:'0 de 3 feitas', sub:'3 no prazo · 0 atrasadas', n:'Prazos: 10/07, 17/07 e 24/07/2022'})},
  {id:'ges_trein', pac:'ges', nome:'Necessidade de treinamento', st:'prem',
   origem:'Falhas da área operacional (ferramenta, força de corte, torque).',
   conta:'Falhas operacionais ÷ total de falhas.',
   porque:'Muitas falhas de operação indicam que os operadores podem precisar de treinamento.',
   val: e => { const ms = maqs(e), op = ms.reduce((a, k) => a + M[k].areas[1], 0), t = ms.reduce((a, k) => a + M[k].areas.reduce((x, y) => x + y, 0), 0);
     return {v:`${op} falhas operacionais`, sub:`${pct(op / t)} das falhas`, n:`${op} ÷ ${t} = ${pct(op / t)}`}; }}
];
const TODOS = ITENS.map(i => i.id);
const PILL = {ok:'Dados atuais', prem:'Com premissa', novo:'Dado novo'};
