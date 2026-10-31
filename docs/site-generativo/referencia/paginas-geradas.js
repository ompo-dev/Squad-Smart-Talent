// ---------------------------------------------------------------- páginas do site gerado (o menu e as telas saem das permissões)
const corVendo = v => (v.startsWith('cargo:') ? C(v.slice(6)).cor : corDe(MB(v)));
const subVendo = v => (v.startsWith('cargo:') ? 'visualizando como cargo' : MB(v).dono ? 'Dono da empresa' : MB(v).cargos.map(id => C(id).nome).join(', ') || 'sem cargo');
const chipsVendo = v => (v.startsWith('cargo:') ? `<span class="rchip"><i style="background:${C(v.slice(6)).cor}"></i>${esc(C(v.slice(6)).nome)}</span>` : MB(v).dono ? '<span class="rchip"><i style="background:#f0b232"></i>Dono da empresa</span>' : MB(v).cargos.map(id => `<span class="rchip"><i style="background:${C(id).cor}"></i>${esc(C(id).nome)}</span>`).join('') || '<span class="rchip">sem cargo</span>');
const kpiHtml = (i, e) => { const r = i.val(e); return `<div class="kpi"><span class="l">${i.nome}</span><span class="v">${r.v}</span><span class="s">${r.sub}</span>${como(i, r)}</div>`; };
const grafHtml = (id, ac) => { const gr = GRAF[id], i = ITEM(id), e = ac[id], r = i.val(e); return `<section class="box chart"><div class="box-head"><div><h2>${gr.t}</h2><p>${gr.s} · ${ESCOPO[e]}</p></div><span class="pill ${i.st}">${PILL[i.st]}</span></div>${gr.g(e)}${como(i, r)}</section>`; };
const alertaHtml = (al, aberto) => `<section class="alerts" aria-label="Alertas"><b class="t">${al.length} ${al.length === 1 ? 'alerta' : 'alertas'}</b>${al.map(a => `<details class="al" ${aberto ? 'open' : ''}><summary>${a.t}</summary><p>${a.d}</p></details>`).join('')}</section>`;

// Colunas da Frota: cada coluna só aparece se a pessoa recebeu a informação daquela coluna
const COLS_FROTA = [
  ['prev_saude', 'Saúde', k => `<span style="color:${corSaude(M[k].saude)};font-weight:700">${M[k].saude}/100</span>`],
  ['prev_chance', 'Chance de falha', k => pct(M[k].chance)],
  ['prev_proxima', 'Próxima falha', k => `~${fmt(M[k].prox, 1)} h`],
  ['op_disp', 'Disponibilidade', k => `${pct(D[k].disp_teto)} a ${pct(D[k].disp_piso)}`],
  ['op_falhas', 'Falhas', k => fmt(D[k].falhas)],
  ['fin_risco', 'Risco por dia', k => brl(M[k].risco)],
  ['man_semdados', 'Última leitura', k => M[k].semdados > 7 ? `<span style="color:var(--red);font-weight:600">${M[k].ultima} · ${M[k].semdados} dias sem dados</span>` : M[k].ultima]
];
const ALERTA_ITENS = ['man_semdados', 'op_disp', 'prev_saude', 'man_alertas'];
const maqsDe = ac => ORDEM.filter(k => Object.values(ac).some(e => maqs(e).includes(k)));

function paginas(v) {
  const ac = acesso(v), tem = id => id in ac, p = poder(v);
  return {
    frota: COLS_FROTA.some(([id]) => tem(id)),
    alertas: ALERTA_ITENS.some(tem),
    pacotes: PACOTES.filter(pk => ITENS.some(i => i.pac === pk.id && tem(i.id))),
    admin: p.pode,
    tarefas: comigo(v).length > 0 || naEquipe(v).length > 0 || p.pode
  };
}

function telaVisao() {
  const ac = acesso(vendo), ids = Object.keys(ac), tem = id => id in ac, pg = paginas(vendo);
  let h = `<div class="title"><h1>Visão geral</h1><p>${vendo.startsWith('cargo:') ? `Vendo como o cargo <b>${esc(C(vendo.slice(6)).nome)}</b>` : `Olá, <b>${esc(nomeVendo(vendo))}</b>`}. Esta tela foi montada com as ${plural(ids.length)} que ${vendo.startsWith('cargo:') ? 'este cargo libera' : 'os seus cargos liberam'}.</p><div class="rchips">${chipsVendo(vendo)}</div></div>`;
  if (!ids.length) return h + '<div class="empty">Nenhum cargo liberou informações para você ainda. Quem gerencia os cargos precisa liberar alguma.</div>';
  const al = alertasDe(ac);
  if (al.length) h += alertaHtml(al.slice(0, 3)) + (al.length > 3 ? `<p class="hint">Mais ${al.length - 3} em Alertas.</p>` : '');
  h += `<div class="kpis">${DESTAQUE.filter(tem).slice(0, 6).map(id => kpiHtml(ITEM(id), ac[id])).join('')}</div>`;
  const gs = Object.keys(GRAF).filter(tem).slice(0, 2);
  if (gs.length) h += `<div class="charts">${gs.map(id => grafHtml(id, ac)).join('')}</div>`;
  const tf = comigo(vendo);
  if (tf.length) h += `<section class="box"><div class="box-head"><h2>Suas tarefas</h2><button type="button" class="btn" data-view="tarefas">Abrir tarefas</button></div><div class="tasks">${tf.slice(0, 3).map(t => `<div class="task-mini"><b>${esc(t.titulo)}</b><span class="hint">até ${t.prazo} · ${t.status}</span></div>`).join('')}</div></section>`;
  h += `<section class="box"><div class="box-head"><h2>Seus pacotes</h2><p>Cada pacote vira uma página no menu</p></div><div class="tiles">${pg.pacotes.map(pk => { const n = ITENS.filter(i => i.pac === pk.id && tem(i.id)).length; return `<button type="button" class="tile pk" data-view="pac:${pk.id}"><div class="tile-top"><b>${pk.nome}</b><span class="pill ok">${n} de ${ITENS.filter(i => i.pac === pk.id).length}</span></div><span class="s">${ITENS.filter(i => i.pac === pk.id && tem(i.id)).map(i => i.nome).join(' · ')}</span></button>`; }).join('')}</div></section>`;
  return h;
}

function telaPacote(pid) {
  const ac = acesso(vendo), pk = PACOTES.find(x => x.id === pid), l = ITENS.filter(i => i.pac === pid && i.id in ac);
  let h = `<div class="title"><h1>${pk.nome}</h1><p>${l.length} de ${ITENS.filter(i => i.pac === pid).length} informações deste pacote liberadas para <b>${esc(nomeVendo(vendo))}</b>.</p></div>`;
  h += `<div class="kpis">${l.slice(0, 4).map(i => kpiHtml(i, ac[i.id])).join('')}</div>`;
  const gs = Object.keys(GRAF).filter(id => l.some(i => i.id === id));
  if (gs.length) h += `<div class="charts">${gs.map(id => grafHtml(id, ac)).join('')}</div>`;
  h += `<section class="box"><div class="box-head"><h2>Todas as informações</h2><p>Abra "De onde vem e como é calculado" em cada uma</p></div><div class="tiles">${l.map(i => tile(i, ac[i.id])).join('')}</div></section>`;
  const fora = ITENS.filter(i => i.pac === pid && !(i.id in ac));
  if (fora.length) h += `<p class="hint">Não liberadas para você neste pacote: ${fora.map(i => i.nome).join(', ')}.</p>`;
  return h;
}

function telaFrota() {
  const ac = acesso(vendo), cols = COLS_FROTA.filter(([id]) => id in ac), ms = ORDEM.filter(k => cols.some(([id]) => maqs(ac[id]).includes(k)));
  const cel = (id, f, k) => (maqs(ac[id]).includes(k) ? f(k) : '<span class="hint">sem acesso</span>');
  return `<div class="title"><h1>Frota</h1><p>As máquinas que os seus cargos liberam, só com as colunas que você recebeu.</p></div>
  <section class="box"><div class="box-head"><h2>Máquinas</h2><p>${ms.length} ${ms.length === 1 ? 'máquina' : 'máquinas'}</p></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Máquina</th><th>Linha</th>${cols.map(([, t]) => `<th>${t}</th>`).join('')}</tr></thead>
    <tbody>${ms.map(k => `<tr><td><b>${M[k].nome}</b></td><td>Shopfloor-${k}</td>${cols.map(([id, , f]) => `<td>${cel(id, f, k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <details><summary>De onde vêm estas colunas</summary><div class="how">${cols.map(([id, t]) => { const i = ITEM(id); return `<div><span>${t}</span>${i.origem} Conta: ${i.conta} Por quê: ${i.porque}</div>`; }).join('')}</div></details>
  </section>`;
}

function telaAlertas() {
  const ac = acesso(vendo), al = alertasDe(ac);
  return `<div class="title"><h1>Alertas</h1><p>Só os alertas das informações e máquinas que você recebeu. Cada um explica de onde vem.</p></div>
  ${al.length ? alertaHtml(al, true) : '<div class="empty">Nenhum alerta nas suas máquinas agora.</div>'}`;
}

function menu() {
  const pg = paginas(vendo), b = (v, t, tag) => `<button class="nav" type="button" data-view="${v}" aria-current="${view === v ? 'page' : 'false'}">${t}${tag ? ` <span class="tag new">${tag}</span>` : ''}</button>`;
  return `<div class="brand"><div class="logo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l3-8 4 16 3-8h4"></path></svg></div><div style="display:flex;flex-direction:column"><b>Telemetry OS</b><span style="font-size:12px;color:var(--muted)">Operations</span></div></div>
    <div class="navgrp"><span>Platform</span>${b('visao', 'Visão geral')}${pg.frota ? b('frota', 'Frota') : ''}${pg.alertas ? b('alertas', 'Alertas', alertasDe(acesso(vendo)).length || '') : ''}${pg.tarefas ? b('tarefas', 'Tarefas', comigo(vendo).length || '') : ''}${b('copiloto', 'Copiloto IA')}</div>
    ${pg.pacotes.length ? `<div class="navgrp"><span>Seus pacotes</span>${pg.pacotes.map(pk => b('pac:' + pk.id, pk.nome)).join('')}</div>` : ''}
    ${pg.admin ? `<div class="navgrp"><span>Sua equipe</span>${b('cargos', 'Cargos')}${b('membros', 'Membros')}</div>` : ''}
    <div class="usercard"><span class="av" style="background:${corVendo(vendo)}">${esc(nomeVendo(vendo).replace(/^o cargo /, '')[0])}</span><div style="min-width:0"><b>${esc(nomeVendo(vendo).replace(/^o cargo /, ''))}</b><span>${esc(subVendo(vendo))}</span></div></div>`;
}

function barraTeste() {
  const chip = (v, nome, cor, extra) => `<button type="button" class="tb-chip" data-ver="${v}" aria-pressed="${vendo === v}"><i style="background:${cor}"></i>${esc(nome)}${extra || ''}</button>`;
  // cada setor numa linha, do cargo de topo até o último nível
  const setores = S.cargos.filter(c => !c.pai && c.id !== 'todos').map(raiz => { const linha = []; const vai = (id, n) => { linha.push(chip('cargo:' + id, C(id).nome, C(id).cor, '')); filhosC(id).forEach(x => vai(x.id, n + 1)); }; vai(raiz.id, 0); return `<div class="tb-setor">${linha.join('<span class="tb-seta">→</span>')}</div>`; }).join('');
  return `<div class="tb-setor">${chip('m0', 'Dono', '#f0b232', ' 👑')}<label class="tb-sep" for="tb-pessoa">ou uma pessoa:</label><select id="tb-pessoa" class="tb-sel"><option value="">escolher…</option>${S.membros.filter(m => !m.dono).map(m => `<option value="${m.id}" ${vendo === m.id ? 'selected' : ''}>${esc(m.nome)} · ${esc(m.cargos.map(id => C(id).nome).join(', ') || 'sem cargo')}</option>`).join('')}</select></div>${setores}`;
}

// ---------------------------------------------------------------- render e eventos
const NOMES = {tarefas:'Tarefas', visao:'Visão geral', frota:'Frota', alertas:'Alertas', cargos:'Cargos', membros:'Membros', copiloto:'Copiloto IA', cardapio:'Cardápio de informações (só no protótipo)', como:'Como funciona (só no protótipo)'};
function permitido(v) {
  const pg = paginas(vendo);
  if (v.startsWith('pac:')) return pg.pacotes.some(pk => 'pac:' + pk.id === v);
  return {frota:pg.frota, alertas:pg.alertas, cargos:pg.admin, membros:pg.admin, tarefas:pg.tarefas}[v] ?? true;
}
function render() {
  if (!vendo.startsWith('cargo:') && !MB(vendo)) vendo = 'm0';
  if (vendo.startsWith('cargo:') && !C(vendo.slice(6))) vendo = 'm0';
  if (!permitido(view)) view = 'visao';
  document.getElementById('tb-chips').innerHTML = barraTeste();
  document.getElementById('side').innerHTML = menu();
  document.getElementById('crumb').textContent = view.startsWith('pac:') ? PACOTES.find(p => 'pac:' + p.id === view).nome : NOMES[view];
  document.querySelectorAll('.tb-tools [data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === view));
  const pagina = view.startsWith('pac:') ? () => telaPacote(view.slice(4)) : ({tarefas:telaTarefas, visao:telaVisao, frota:telaFrota, alertas:telaAlertas, cargos:telaCargos, membros:telaMembros, copiloto:telaCopiloto, cardapio:telaCardapio, como:telaComo})[view];
  document.getElementById('view').innerHTML = pagina();
}
