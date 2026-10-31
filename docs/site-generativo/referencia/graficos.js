
// ---------------------------------------------------------------- séries reais para os gráficos
const COR = {L1:'#93c5fd', L2:'#2563eb', L3:'#ea580c'};
const MES_LAB = ['dez', 'jan', 'fev', 'mar', 'abr', 'mai'];
const FALHAS_MES = {L1:[8, 34, 90, 194, 110, 16], L2:[3, 23, 93, 167, 87, 20], L3:[2, 30, 113, 172, 83, 14]};
const DISP_MES = {L1:[94.9, 93.0, 85.5, 71.8, 82.3, 96.7], L2:[97.3, 95.1, 85.1, 75.8, 86.9, 95.5], L3:[98.2, 93.9, 81.8, 75.0, 87.5, 96.3]};
const CHANCE_SEM = {
  L1:[.738, .487, .469, .565, .64, .523, .524, .521, .484, .496, .493, .541, .591, .512, .506, .527, .487, .385, .572, .504, .262],
  L2:[.554, .646, .29, .31, .431, .607, .572, .576, .515, .461, .438, .461, .528, .533, .39, .403, .524, .488, .487, .553, .303],
  L3:[.661, .553, .567, .415, .57, .635, .559, .563, .53, .496, .391, .458, .499, .558, .451, .544, .406, .581, .53, .656, .422]
};
const HP_SEM = {
  L1:[83.2, 88.8, 105.7, 92.0, 98.6, 106.3, 101.6, 105.6, 106.3, 99.5, 96.7, 95.7, 99.1, 100.8, 93.0, 95.7, 104.2, 115.6, 106.1, 93.3, 126.1],
  L2:[100.0, 92.2, 112.2, 113.2, 116.2, 97.8, 95.2, 98.7, 102.3, 107.5, 100.3, 103.4, 105.3, 107.0, 99.0, 106.6, 108.4, 109.8, 100.2, 97.0, 136.9],
  L3:[90.9, 109.5, 90.5, 109.5, 98.8, 93.0, 96.5, 99.2, 101.3, 102.3, 102.1, 103.6, 104.0, 101.5, 100.0, 94.5, 112.1, 85.3, 87.0, 81.6, 99.5]
};
const PESOS = [['Pressão hidráulica', -1.38], ['Força de corte', .92], ['Torque', -.89], ['Rotação do fuso', .36], ['Temp. do refrigerante', .25], ['Pressão do refrigerante', .21]];
const SEM_MESES = [[0, 'jan'], [4, 'fev'], [8, 'mar'], [13, 'abr'], [17, 'mai']];

const legenda = e => `<div class="legend">${maqs(e).map(k => `<span><i style="background:${COR[k]}"></i>${M[k].nome}</span>`).join('')}</div>`;

// Barras empilhadas por mês (uma cor por máquina)
function svgEmpilhado(e, valores, fmtTopo) {
  const ms = maqs(e), n = MES_LAB.length, tot = MES_LAB.map((_, i) => ms.reduce((a, k) => a + valores[k][i], 0));
  const max = Math.max(...tot), slot = 540 / n, bw = slot * .5;
  let g = '';
  MES_LAB.forEach((lab, i) => {
    let y = 200; const x = 50 + i * slot + (slot - bw) / 2;
    [...ms].reverse().forEach(k => { const h = valores[k][i] / max * 165; y -= h; g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${COR[k]}"></rect>`; });
    g += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#0a0a0a">${fmtTopo(tot[i])}</text>`;
    g += `<text x="${(x + bw / 2).toFixed(1)}" y="218" text-anchor="middle" font-size="11" fill="#52525b">${lab}</text>`;
  });
  return `<svg viewBox="0 0 600 228" role="img" aria-label="Barras por mês"><line x1="40" y1="200" x2="595" y2="200" stroke="#d4d4d8"></line>${g}</svg>`;
}
// Barras agrupadas de disponibilidade (60% a 100%) com a meta de 90%
function svgDisp(e) {
  const ms = maqs(e), slot = 540 / MES_LAB.length, bw = Math.min(16, slot * .7 / ms.length), y = v => 200 - (Math.max(60, v) - 60) / 40 * 175;
  let g = `<rect x="40" y="${y(90).toFixed(1)}" width="555" height="1.2" fill="#16a34a"></rect><text x="44" y="${(y(90) - 5).toFixed(1)}" text-anchor="start" font-size="11" fill="#166534">meta 90%</text>`;
  MES_LAB.forEach((lab, i) => {
    const x0 = 50 + i * slot + (slot - bw * ms.length - 3 * (ms.length - 1)) / 2;
    ms.forEach((k, j) => { const v = DISP_MES[k][i], yy = y(v); g += `<rect x="${(x0 + j * (bw + 3)).toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${(200 - yy).toFixed(1)}" fill="${COR[k]}"><title>${M[k].nome} ${lab}: ${fmt(v, 1)}%</title></rect>`; });
    g += `<text x="${(50 + i * slot + slot / 2).toFixed(1)}" y="218" text-anchor="middle" font-size="11" fill="#52525b">${lab}</text>`;
  });
  return `<svg viewBox="0 0 600 228" role="img" aria-label="Disponibilidade por mês"><line x1="40" y1="200" x2="595" y2="200" stroke="#d4d4d8"></line><text x="34" y="29" text-anchor="end" font-size="11" fill="#52525b">100%</text><text x="34" y="204" text-anchor="end" font-size="11" fill="#52525b">60%</text>${g}</svg>`;
}
// Linhas semanais (jan a mai/2022)
function svgLinhas(e, serie, min, max, rotulo, limite) {
  const x = i => 50 + i * 27.2, y = v => 200 - (Math.min(max, Math.max(min, v)) - min) / (max - min) * 175;
  let g = '';
  if (limite) g += `<rect x="40" y="${y(limite).toFixed(1)}" width="555" height="${(200 - y(limite)).toFixed(1)}" fill="#fff7ed"></rect><line x1="40" y1="${y(limite).toFixed(1)}" x2="595" y2="${y(limite).toFixed(1)}" stroke="#ea580c" stroke-dasharray="5 4"></line><text x="590" y="194" text-anchor="end" font-size="11" fill="#9a3412">zona de alerta (abaixo de ${fmt(limite, 1)} bar)</text>`;
  maqs(e).forEach(k => { g += `<polyline points="${serie[k].map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ')}" fill="none" stroke="${COR[k]}" stroke-width="2.5" stroke-linejoin="round"></polyline>`; });
  SEM_MESES.forEach(([i, m]) => { g += `<text x="${x(i).toFixed(1)}" y="218" text-anchor="middle" font-size="11" fill="#52525b">${m}</text>`; });
  return `<svg viewBox="0 0 600 228" role="img" aria-label="Linhas semanais"><line x1="40" y1="25" x2="595" y2="25" stroke="#f4f4f5"></line><line x1="40" y1="200" x2="595" y2="200" stroke="#d4d4d8"></line><text x="34" y="29" text-anchor="end" font-size="11" fill="#52525b">${rotulo[1]}</text><text x="34" y="204" text-anchor="end" font-size="11" fill="#52525b">${rotulo[0]}</text>${g}</svg>`;
}
// Barras horizontais em HTML
const hbar = (linhas, max) => `<div style="display:flex;flex-direction:column;gap:10px">${linhas.map(([rot, v, cor, txt]) => `<div class="hrow"><span>${rot}</span><div class="htrack"><div style="width:${Math.max(1.5, Math.abs(v) / max * 100).toFixed(1)}%;background:${cor}"></div></div><span class="n">${txt}</span></div>`).join('')}</div>`;
const corSaude = s => (s < 50 ? '#dc2626' : s < 70 ? '#d97706' : '#16a34a');

const GRAF = {
  fin_custo: {t:'Custo das paradas por mês', s:'Teto: cada registro de falha conta como uma parada de R$ 204,96', g: e => svgEmpilhado(e, Object.fromEntries(ORDEM.map(k => [k, FALHAS_MES[k].map(n => n * CF)])), v => 'R$ ' + fmt(v / 1000, 1) + ' mil') + legenda(e)},
  op_falhas: {t:'Falhas por mês', s:'O pico de março acompanha o maior número de registros; a taxa fica perto de 50%', g: e => svgEmpilhado(e, FALHAS_MES, v => fmt(v)) + legenda(e)},
  op_disp: {t:'Disponibilidade por mês', s:'Teto de paradas · escala de 60% a 100%', g: e => svgDisp(e) + legenda(e)},
  prev_chance: {t:'Chance de falha semana a semana', s:'Média da chance prevista pelo modelo em cada semana · de 0% a 100%', g: e => svgLinhas(e, CHANCE_SEM, 0, 1, ['0%', '100%']) + legenda(e)},
  man_alertas: {t:'Pressão hidráulica semana a semana', s:'Média semanal · abaixo de 101,7 bar o alerta dispara', g: e => svgLinhas(e, HP_SEM, 70, 140, ['70', '140'], 101.7) + legenda(e)},
  fin_risco: {t:'Risco em R$ por dia', s:'Chance de falha × registros por dia × R$ 204,96', g: e => hbar(maqs(e).map(k => [M[k].nome, M[k].risco, COR[k], brl(M[k].risco)]), 700)},
  prev_saude: {t:'Saúde das máquinas', s:'100 − chance de falha · abaixo de 50 é crítica', g: e => hbar(maqs(e).map(k => [M[k].nome, M[k].saude, corSaude(M[k].saude), M[k].saude + '/100']), 100)},
  man_areas: {t:'Falhas por área', s:'Área do sensor que mais pesou em cada falha (premissa)', g: e => { const a = maqs(e).reduce((t, k) => t.map((v, i) => v + M[k].areas[i]), [0, 0, 0, 0]); return hbar([['Mecânica', a[0], '#ea580c', fmt(a[0])], ['Operacional', a[1], '#2563eb', fmt(a[1])], ['Automação', a[2], '#93c5fd', fmt(a[2])], ['Elétrica', a[3], '#a1a1aa', fmt(a[3])]], a[0]); }},
  prev_modelo: {t:'O que mais pesa na falha', s:'Peso de cada sensor no modelo · laranja: valor baixo puxa a falha; azul: valor alto puxa', g: () => hbar(PESOS.map(([r, v]) => [r, v, v < 0 ? '#ea580c' : '#2563eb', (v > 0 ? '+' : '') + fmt(v, 2)]), 1.38)}
};
const DESTAQUE = ['fin_custo', 'op_disp', 'prev_proxima', 'prev_saude', 'man_alertas', 'fin_risco', 'op_falhas', 'man_semdados', 'fin_economia', 'ges_status', 'fin_parada', 'prev_chance'];

