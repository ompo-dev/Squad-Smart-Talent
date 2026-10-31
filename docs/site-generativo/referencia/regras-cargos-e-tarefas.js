
// ---------------------------------------------------------------- cargos em árvore (setores) e membros
// Cada cargo fica embaixo de um cargo pai. Só pode ter o que o pai tem. Quem tem um cargo que "pode repassar"
// cria e edita os cargos abaixo do seu, e delega tarefas para eles. O dono fica acima de todos.
const CORES = ['#3498db', '#2ecc71', '#9b59b6', '#e91e63', '#f1c40f', '#e67e22', '#e74c3c', '#1abc9c', '#607d8b', '#95a5a6'];
const TUDO = ['L1', 'L2', 'L3'];
const EXEMPLO = () => ({
  cargos: [
    {id:'g1', pai:null, nome:'Gerência da planta', cor:'#3498db', itens:TODOS.filter(i => /^(op|prev|man|ges)_/.test(i)), maqs:TUDO, repassa:true},
    {id:'g2', pai:'g1', nome:'Supervisão de manutenção', cor:'#9b59b6', itens:TODOS.filter(i => /^(prev|man|ges)_/.test(i)), maqs:TUDO, repassa:true},
    {id:'g3', pai:'g2', nome:'Técnico da L3', cor:'#e67e22', itens:['man_alertas', 'man_semdados', 'prev_saude', 'prev_proxima', 'prev_chance', 'ges_5w2h', 'ges_status'], maqs:['L3'], repassa:true},
    {id:'g4', pai:'g3', nome:'Auxiliar da L3', cor:'#e74c3c', itens:['man_alertas', 'prev_proxima', 'ges_5w2h'], maqs:['L3'], repassa:false},
    {id:'f1', pai:null, nome:'Financeiro', cor:'#2ecc71', itens:TODOS.filter(i => i.startsWith('fin_')), maqs:TUDO, repassa:true},
    {id:'f2', pai:'f1', nome:'Analista financeiro', cor:'#1abc9c', itens:['fin_custo', 'fin_parada', 'fin_risco'], maqs:TUDO, repassa:true},
    {id:'f3', pai:'f2', nome:'Estagiário', cor:'#f1c40f', itens:['fin_parada'], maqs:TUDO, repassa:false},
    {id:'todos', pai:null, nome:'@todos', cor:'#99aab5', itens:[], maqs:TUDO, repassa:false}
  ],
  membros: [
    {id:'m0', nome:'Você', dono:true, cargos:[]},
    {id:'m1', nome:'Pessoa B', cargos:['g1']}, {id:'m2', nome:'Pessoa C', cargos:['g2']}, {id:'m3', nome:'Pessoa D', cargos:['g3']},
    {id:'m4', nome:'Pessoa E', cargos:['g4']}, {id:'m5', nome:'Pessoa F', cargos:['f1']}, {id:'m6', nome:'Pessoa G', cargos:['f2']}, {id:'m7', nome:'Pessoa H', cargos:['f3']}
  ],
  tarefas: [
    {id:'t1', titulo:'Revisar bomba, filtros e vazamentos do sistema hidráulico', item:'man_alertas', prazo:'10/07/2022', status:'a fazer', cargo:'g1', cadeia:['g1']},
    {id:'t2', titulo:'Trocar ou afiar a ferramenta e revisar o avanço de corte', item:'ges_5w2h', prazo:'17/07/2022', status:'a fazer', cargo:'g2', cadeia:['g1', 'g2']},
    {id:'t3', titulo:'Conferir fixação da peça e desgaste da ferramenta', item:'ges_5w2h', prazo:'24/07/2022', status:'em andamento', cargo:'g3', cadeia:['g1', 'g2', 'g3']},
    {id:'t4', titulo:'Confirmar com a controladoria o custo real da hora parada', item:'fin_parada', prazo:'15/07/2022', status:'a fazer', cargo:'f1', cadeia:['f1']}
  ]
});
const CHAVE = 'simulador-site-generativo-v6';
let S;
try { S = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { S = null; }
if (!S || !Array.isArray(S.cargos) || !Array.isArray(S.tarefas)) S = EXEMPLO();
const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) {} };
let vendo = 'm0', view = 'visao', cargoSel = 'g1', aba = 'perm', rascunho = null, membroSel = 'm1', busca = '', chat = [];

const C = id => S.cargos.find(c => c.id === id);
const MB = id => S.membros.find(m => m.id === id);
const plural = n => `${n} ${n === 1 ? 'informação' : 'informações'}`;
const filhosC = id => S.cargos.filter(c => c.pai === id);
const descendentes = id => filhosC(id).flatMap(c => [c.id, ...descendentes(c.id)]);
const ancestrais = id => { const out = []; for (let c = C(id); c && c.pai; c = C(c.pai)) out.push(c.pai); return out; };
// Ordem de árvore: setores na ordem da lista, cada cargo seguido dos que estão abaixo dele; @todos no fim
const emArvore = () => { const out = []; const vai = (id, n) => { out.push({c:C(id), n}); filhosC(id).forEach(f => vai(f.id, n + 1)); }; S.cargos.filter(c => !c.pai && c.id !== 'todos').forEach(c => vai(c.id, 0)); out.push({c:C('todos'), n:0}); return out; };
const cargosDe = m => S.cargos.filter(c => c.id === 'todos' || m.cargos.includes(c.id));
const corDe = m => (m.dono ? '#f0b232' : (emArvore().map(x => x.c).find(c => m.cargos.includes(c.id)) || {cor:'#a1a1aa'}).cor);
const meusCargos = v => (v.startsWith('cargo:') ? [v.slice(6)] : MB(v).dono ? [] : MB(v).cargos);
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 6000); }

// O que cada informação mostra para quem está vendo: item -> máquinas (união dos cargos que dão aquele item)
function acesso(v) {
  const out = {};
  if (!v.startsWith('cargo:') && MB(v).dono) { TODOS.forEach(i => { out[i] = 'all'; }); return out; }
  const cs = v.startsWith('cargo:') ? [C(v.slice(6)), C('todos')] : cargosDe(MB(v));
  cs.forEach(c => c.itens.forEach(i => { out[i] = [...new Set([...(out[i] || []), ...c.maqs])]; }));
  Object.keys(out).forEach(i => { if (!out[i].length) delete out[i]; else out[i] = chaveEscopo(out[i]); });
  return out;
}
const nomeVendo = v => (v.startsWith('cargo:') ? `o cargo ${C(v.slice(6)).nome}` : MB(v).nome);

// Quem pode mexer em quê: o dono em tudo; os outros, nos cargos abaixo de um cargo seu que pode repassar
function poder(v) {
  if (!v.startsWith('cargo:') && MB(v).dono) return {dono:true, pode:true, gerencia:S.cargos.map(c => c.id)};
  const base = meusCargos(v).filter(id => C(id) && C(id).repassa);
  return {dono:false, pode:base.length > 0, base, gerencia:[...new Set(base.flatMap(descendentes))]};
}
const editavel = (v, id) => poder(v).gerencia.includes(id);
const podeCriarAbaixo = (v, id) => { const p = poder(v); return id !== 'todos' && (p.dono || p.base.includes(id) || (p.gerencia.includes(id) && C(id).repassa)); };
// O que dá para ligar num cargo: o que o pai dele tem (cargo de topo: tudo, só o dono mexe)
const limiteDe = c => (c.pai ? {itens:C(c.pai).itens, maqs:C(c.pai).maqs} : {itens:TODOS, maqs:TUDO});

// Regra "tirou de cima, sai de baixo": cada cargo só pode ter o que o pai tem, descendo a árvore inteira
function cascata() {
  const perdas = [];
  const desce = id => filhosC(id).forEach(c => {
    const pai = C(id), pi = c.itens.filter(x => !pai.itens.includes(x)), pm = c.maqs.filter(x => !pai.maqs.includes(x));
    if (pi.length || pm.length) {
      c.itens = c.itens.filter(x => pai.itens.includes(x)); c.maqs = c.maqs.filter(x => pai.maqs.includes(x));
      perdas.push(`${c.nome} perdeu ${[pi.length ? plural(pi.length) : '', pm.length ? pm.map(k => M[k].nome).join(', ') : ''].filter(Boolean).join(' e ')}`);
    }
    desce(c.id);
  });
  S.cargos.filter(c => !c.pai).forEach(c => desce(c.id));
  return perdas;
}

// ---------------------------------------------------------------- tarefas que descem pela cadeia
// Só delega a tarefa quem está com ela (num cargo que pode repassar), só para um cargo abaixo, e esse cargo precisa ver a informação da tarefa
const comigo = v => S.tarefas.filter(t => (!v.startsWith('cargo:') && MB(v).dono) || meusCargos(v).includes(t.cargo));
const naEquipe = v => { const g = poder(v).gerencia; return S.tarefas.filter(t => !comigo(v).includes(t) && g.includes(t.cargo)); };
function destinos(v, t) {
  const dono = !v.startsWith('cargo:') && MB(v).dono;
  if (!dono && !(C(t.cargo).repassa && meusCargos(v).includes(t.cargo))) return [];
  return (dono ? S.cargos.map(c => c.id) : descendentes(t.cargo)).filter(id => id !== t.cargo && id !== 'todos' && C(id).itens.includes(t.item));
}
const STATUS = ['a fazer', 'em andamento', 'feita'];

// ---------------------------------------------------------------- explicações reutilizadas em tudo que aparece
const como = (i, r, aberto) => `<details ${aberto ? 'open' : ''}><summary>De onde vem e como é calculado</summary><div class="how"><div><span>De onde vem</span>${i.origem}</div><div><span>Conta</span>${i.conta}</div><div><span>Com os números</span><code>${r.n}</code></div><div><span>Por quê</span>${i.porque}</div></div></details>`;
const ITEM = id => ITENS.find(i => i.id === id);
const tile = (i, e) => { const r = i.val(e); return `<article class="tile"><div class="tile-top"><b>${i.nome}</b><span class="pill ${i.st}">${PILL[i.st]}</span></div><div class="v">${r.v}</div><div class="s">${r.sub} · ${ESCOPO[e]}</div>${como(i, r)}</article>`; };
function alertasDe(ac) {
  const out = [], e = id => ac[id];
  if (e('man_semdados')) maqs(e('man_semdados')).filter(k => M[k].semdados > 7).forEach(k => out.push({t:`${M[k].nome} sem enviar dados há ${M[k].semdados} dias`, d:`Última leitura em ${M[k].ultima}; a frota tem leitura até 03/07/2022. Regra: alerta acima de 7 dias. Por quê: sem dado, o painel fica cego para essa máquina.`}));
  if (e('op_disp')) { const ab = maqs(e('op_disp')).filter(k => D[k].disp_teto < .9); if (ab.length) out.push({t:`${ab.map(k => M[k].nome).join(', ')} abaixo da meta de disponibilidade`, d:'Disponibilidade = 1 − horas paradas ÷ horas possíveis, contando cada registro de falha como uma parada de 1,08 h. Meta de 90% (Nakajima, OEE de classe mundial).'}); }
  if (e('prev_saude')) maqs(e('prev_saude')).filter(k => M[k].saude < 50).forEach(k => out.push({t:`Saúde da ${M[k].nome} crítica: ${M[k].saude}/100`, d:`Saúde = 100 − chance de falha (${fmt(M[k].chance * 100, 1)}%), prevista pelo modelo com os 12 sensores. Abaixo de 50 é crítica.`}));
  if (e('man_alertas')) maqs(e('man_alertas')).filter(k => M[k].hp >= 15).forEach(k => out.push({t:`${M[k].nome}: pressão hidráulica baixa em ${M[k].hp} dos últimos 30 registros`, d:'Limite de 101,7 bar = meio entre a média nas falhas (84,8) e a normal (118,6). Por quê: é o sensor que mais pesa na chance de falha.'}));
  return out;
}
const svgCadeado = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
const svgPessoa = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c1-4 4-6 8-6s7 2 8 6"></path></svg>';
const sw = (id, on, dis, label) => `<button type="button" role="switch" class="sw" aria-checked="${on}" ${dis ? 'disabled' : ''} data-sw="${id}" aria-label="${label}"><span></span></button>`;
const guia = passos => `<div class="guia">${passos.map((p, i) => `<div><b class="n">${i + 1}</b><span>${p}</span></div>`).join('')}</div>`;
const chipCargo = id => `<span class="rchip"><i style="background:${C(id).cor}"></i>${esc(C(id).nome)}</span>`;

// ---------------------------------------------------------------- tela de cargos
function telaCargos() {
  const p = poder(vendo);
  if (!C(cargoSel)) cargoSel = S.cargos[0].id;
  const c = rascunho && rascunho.id === cargoSel ? rascunho : C(cargoSel), ed = editavel(vendo, c.id), lim = limiteDe(c);
  const membros = c.id === 'todos' ? S.membros : S.membros.filter(m => m.cargos.includes(c.id));
  const lista = emArvore().map(({c:x, n}) => { const qt = x.id === 'todos' ? S.membros.length : S.membros.filter(m => m.cargos.includes(x.id)).length;
    return `<button type="button" class="dc-role" data-cargo="${x.id}" aria-current="${x.id === cargoSel}" style="padding-left:${10 + n * 18}px">${n ? '<span class="ramo">↳</span>' : ''}<i style="background:${x.cor}"></i><span class="nm">${esc(x.nome)}</span>${editavel(vendo, x.id) ? '' : `<span class="lk" title="Fora da sua área">${svgCadeado}</span>`}<span class="ct">${svgPessoa}${qt}</span></button>`; }).join('');
  const sujo = rascunho && JSON.stringify(rascunho) !== JSON.stringify(C(rascunho.id));
  const paiTxt = c.pai ? `Fica abaixo de ${chipCargo(c.pai)}. Só pode ter o que esse cargo tem.` : c.id === 'todos' ? 'Vale para todo mundo da empresa.' : 'Cargo do topo de um setor: só o dono configura.';
  let corpo = '';
  if (aba === 'perm') {
    const q = busca.toLowerCase();
    corpo = `<input class="dc-search" id="r-busca" placeholder="Buscar informações" value="${esc(busca)}" autocomplete="off" aria-label="Buscar informações">
      ${q && !'pode repassar'.includes(q) ? '' : `<div class="dc-grp">Delegar para baixo</div>
      <div class="dc-perm"><div class="dc-perm-top"><b>Pode repassar</b>${sw('repassa', c.repassa, !ed || c.id === 'todos', 'Pode repassar')}</div>
      <p>Quem tem este cargo pode criar cargos abaixo dele, dar esses cargos a pessoas e delegar tarefas para baixo, sempre só com o que este cargo tem. Deixe desligado só no último nível.</p></div>`}
      ${PACOTES.map(pk => { const l = ITENS.filter(i => i.pac === pk.id && (!q || i.nome.toLowerCase().includes(q))); if (!l.length) return '';
        return `<div class="dc-grp">${pk.nome}</div>${l.map(i => { const pode = ed && lim.itens.includes(i.id), on = c.itens.includes(i.id), r = i.val('all');
          return `<div class="dc-perm${pode ? '' : ' off'}"><div class="dc-perm-top"><b>${i.nome} <span class="pill ${i.st}">${PILL[i.st]}</span></b>${pode ? '' : `<span class="lk" title="${ed ? 'O cargo de cima não tem esta informação' : 'Fora da sua área'}">${svgCadeado}</span>`}${sw(i.id, on, !pode, i.nome)}</div>
            <p>${i.porque}</p><details><summary>De onde vem e como é calculado</summary><div class="how"><div><span>De onde vem</span>${i.origem}</div><div><span>Conta</span>${i.conta}</div><div><span>Exemplo, todas as máquinas</span><code>${r.n}</code></div></div></details></div>`; }).join('')}`; }).join('')}`;
  } else if (aba === 'maqs') {
    corpo = `<p class="dc-hint">O cargo só enxerga as máquinas ligadas aqui, e só pode ter as que o cargo de cima tem.</p>
      ${TUDO.map(k => { const pode = ed && lim.maqs.includes(k); return `<div class="dc-perm${pode ? '' : ' off'}"><div class="dc-perm-top"><b><span class="hash">#</span> makino-${k.toLowerCase()}</b>${pode ? '' : `<span class="lk">${svgCadeado}</span>`}${sw('maq:' + k, c.maqs.includes(k), !pode, M[k].nome)}</div>
        <p>Centro de usinagem ${M[k].nome}, linha própria (Shopfloor-${k}). Última leitura: ${M[k].ultima}.</p></div>`; }).join('')}`;
  } else if (aba === 'memb') {
    const fora = S.membros.filter(m => !m.dono && !m.cargos.includes(c.id));
    corpo = c.id === 'todos' ? '<p class="dc-hint">Todo membro da empresa tem o @todos.</p>' : `
      ${ed && fora.length ? `<div class="dc-add"><select id="r-add" aria-label="Dar este cargo a uma pessoa">${fora.map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}</select><button type="button" class="dc-btn" id="r-addbtn">Dar este cargo</button></div>` : ''}
      ${membros.length ? membros.map(m => `<div class="dc-member"><span class="av" style="background:${corDe(m)}">${esc(m.nome[0])}</span><span>${esc(m.nome)}</span>${ed ? `<button type="button" class="dc-x" data-tirar="${m.id}" aria-label="Tirar ${esc(m.nome)} do cargo">×</button>` : ''}</div>`).join('') : '<p class="dc-hint">Ninguém tem este cargo ainda.</p>'}`;
  } else {
    corpo = `<label class="dc-f">Nome do cargo<input id="r-nome" value="${esc(c.nome)}" ${ed && c.id !== 'todos' ? '' : 'disabled'} autocomplete="off"></label>
      <div class="dc-f">Cor<div class="swatches">${CORES.map(k => `<button type="button" class="swatch" data-cor="${k}" style="background:${k}" aria-label="Cor ${k}" aria-pressed="${c.cor === k}" ${ed && c.id !== 'todos' ? '' : 'disabled'}></button>`).join('')}</div></div>`;
  }
  const quem = p.dono ? 'como dono, pode mexer em todos os cargos.' : p.pode ? `pode mexer nos cargos abaixo de ${p.base.map(id => esc(C(id).nome)).join(' e ')}.` : 'só pode olhar: o seu cargo não repassa.';
  return `<div class="title"><h1>Cargos</h1><p>Cada setor é uma árvore: o cargo de cima repassa para os de baixo, até o último nível. Você está como <b>${esc(nomeVendo(vendo))}</b>: ${quem}</p></div>
  ${guia(['Escolha um cargo seu e clique em <b>Criar cargo abaixo</b>, ou escolha um cargo abaixo do seu.', 'Em <b>O que vê</b> e <b>Máquinas</b>, ligue só o que o cargo de cima tem.', 'Salve, dê o cargo a uma pessoa em <b>Pessoas</b> e veja a tela dela na barra amarela.'])}
  <div class="dc">
    <aside class="dc-side"><div class="dc-head"><span>Setores e cargos</span>${p.dono ? '<button type="button" class="dc-btn" id="r-criar-topo">Novo setor</button>' : ''}</div>
      <p class="dc-hint" style="padding:0 6px 6px">Cada cargo fica embaixo do cargo que repassa para ele. Os nomes são exemplos: a empresa cria os seus.</p>${lista}</aside>
    <section class="dc-main">
      <div class="dc-title"><div><h2>${esc(c.nome)}</h2><p class="dc-hint">${paiTxt}</p></div>
        <div class="dc-tools"><button type="button" class="dc-btn ghost" data-vercargo="${c.id}">Ver o site como este cargo</button>
          ${podeCriarAbaixo(vendo, c.id) ? '<button type="button" class="dc-btn" id="r-criar">Criar cargo abaixo</button>' : ''}
          ${ed && c.id !== 'todos' ? '<button type="button" class="dc-btn danger" id="r-excluir">Excluir</button>' : ''}</div></div>
      <div class="dc-tabs" role="tablist">${[['perm', `O que vê (${c.itens.length})`], ['maqs', `Máquinas (${c.maqs.length})`], ['memb', `Pessoas (${membros.length})`], ['exib', 'Nome e cor']].map(([k, t]) => `<button type="button" role="tab" class="dc-tab" data-aba="${k}" aria-selected="${aba === k}">${t}</button>`).join('')}</div>
      <div class="dc-body">${ed ? '' : `<p class="dc-lock">${svgCadeado} Só leitura: este cargo não está abaixo de um cargo seu que repassa.</p>`}${corpo}</div>
      ${sujo ? '<div class="dc-save"><span>Você tem mudanças não salvas.</span><div><button type="button" class="dc-btn ghost" id="r-reset">Desfazer</button><button type="button" class="dc-btn green" id="r-salvar">Salvar</button></div></div>' : ''}
    </section>
  </div>`;
}

// ---------------------------------------------------------------- membros
function telaMembros() {
  const p = poder(vendo), m = MB(membroSel) || S.membros[0]; membroSel = m.id;
  const grupos = [{nome:'Dono', l:S.membros.filter(x => x.dono)}].concat(emArvore().filter(x => x.c.id !== 'todos').map(({c}) => ({nome:c.nome, l:S.membros.filter(x => !x.dono && x.cargos.length && emArvore().map(y => y.c).find(y => x.cargos.includes(y.id)).id === c.id)})), [{nome:'Sem cargo', l:S.membros.filter(x => !x.dono && !x.cargos.length)}]);
  const daveis = emArvore().map(x => x.c).filter(c => c.id !== 'todos' && !m.cargos.includes(c.id) && p.gerencia.includes(c.id));
  const ac = acesso(m.id);
  return `<div class="title"><h1>Membros</h1><p>As pessoas da empresa e os cargos de cada uma. Quem tem mais de um cargo vê a soma deles.</p></div>
  ${guia(['Escolha uma pessoa na lista.', 'Dê ou tire cargos dela (só os da sua área).', 'Clique em <b>Ver o site como</b> para conferir o que ela vê.'])}
  <div class="dc">
    <aside class="dc-side">${grupos.filter(g => g.l.length).map(g => `<div class="dc-grp" style="padding:10px 6px 2px">${esc(g.nome)} (${g.l.length})</div>${g.l.map(x => `<button type="button" class="dc-role" data-membro="${x.id}" aria-current="${x.id === membroSel}"><span class="av" style="background:${corDe(x)}">${esc(x.nome[0])}</span><span class="nm">${esc(x.nome)}${x.dono ? ' 👑' : ''}</span></button>`).join('')}`).join('')}
      ${p.pode ? `<form id="m-novo" class="dc-add" style="padding:12px 6px" novalidate><input id="m-nome" placeholder="Nome de quem vai entrar" autocomplete="off" aria-label="Nome do novo membro"><button class="dc-btn" type="submit">Adicionar</button></form>` : ''}</aside>
    <section class="dc-main">
      <div class="dc-profile"><span class="av big" style="background:${corDe(m)}">${esc(m.nome[0])}</span><div><h2>${esc(m.nome)}</h2><p class="dc-hint">${m.dono ? 'Dono da empresa: vê e gerencia tudo.' : `${plural(Object.keys(ac).length)} liberadas pelos cargos`}</p></div></div>
      <div class="dc-body">
        <div class="dc-grp">Cargos</div>
        <div class="rchips">${m.dono ? '<span class="rchip"><i style="background:#f0b232"></i>Dono</span>' : m.cargos.map(id => `<span class="rchip"><i style="background:${C(id).cor}"></i>${esc(C(id).nome)}${p.gerencia.includes(id) ? `<button type="button" class="dc-x" data-tirarcargo="${id}" aria-label="Tirar cargo">×</button>` : ''}</span>`).join('') + '<span class="rchip"><i style="background:#99aab5"></i>@todos</span>'}</div>
        ${!m.dono && daveis.length ? `<div class="dc-add"><select id="m-cargo" aria-label="Dar cargo">${daveis.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select><button type="button" class="dc-btn" id="m-darcargo">Dar cargo</button></div>` : ''}
        <div class="dc-grp">O que aparece para ${esc(m.nome)}</div>
        ${Object.keys(ac).length ? PACOTES.map(pk => { const l = ITENS.filter(i => i.pac === pk.id && i.id in ac); return l.length ? `<p class="dc-line"><b>${pk.nome}:</b> ${l.map(i => `${i.nome} <span class="dc-hint">(${ESCOPO[ac[i.id]]})</span>`).join(' · ')}</p>` : ''; }).join('') : '<p class="dc-hint">Nada ainda.</p>'}
        <div class="btns"><button type="button" class="dc-btn" data-vermembro="${m.id}">Ver o site como ${esc(m.nome)}</button>${!m.dono && p.dono ? '<button type="button" class="dc-btn danger" id="m-remover">Remover da empresa</button>' : ''}</div>
      </div>
    </section>
  </div>`;
}

// ---------------------------------------------------------------- tarefas
function cartaoTarefa(t, podeAgir) {
  const ds = podeAgir ? destinos(vendo, t) : [], it = ITEM(t.item);
  return `<article class="task"><div class="task-top"><b>${esc(t.titulo)}</b><span class="pill ${t.status === 'feita' ? 'ok' : t.status === 'em andamento' ? 'prem' : 'novo'}">${t.status}</span></div>
    <div class="task-meta"><span>Prazo ${t.prazo}</span><span>Com ${chipCargo(t.cargo)}</span><span>Precisa ver: ${it.nome}</span></div>
    <div class="cadeia"><span class="hint">Caminho:</span> Dono ${t.cadeia.map(id => `→ ${C(id) ? chipCargo(id) : 'cargo removido'}`).join(' ')}</div>
    ${podeAgir ? `<div class="task-acts">
      <select data-status="${t.id}" aria-label="Mudar status">${STATUS.map(s => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      ${ds.length ? `<select data-dest="${t.id}" aria-label="Delegar para">${ds.map(id => `<option value="${id}">${esc(C(id).nome)}</option>`).join('')}</select><button type="button" class="btn" data-delegar="${t.id}">Delegar para baixo</button>` : `<span class="hint">${C(t.cargo).repassa ? 'Nenhum cargo abaixo vê a informação desta tarefa.' : 'Último nível: este cargo executa, não repassa.'}</span>`}
    </div>` : ''}
  </article>`;
}
function telaTarefas() {
  const p = poder(vendo), minhas = comigo(vendo), equipe = naEquipe(vendo);
  const alvos = emArvore().map(x => x.c).filter(c => c.id !== 'todos' && (p.dono || p.gerencia.includes(c.id)));
  return `<div class="title"><h1>Tarefas</h1><p>As ações descem pela cadeia: quem está com a tarefa pode delegar para um cargo abaixo, desde que esse cargo veja a informação da tarefa. O último nível executa.</p></div>
  <section class="box"><div class="box-head"><h2>Com você</h2><p>${minhas.length} ${minhas.length === 1 ? 'tarefa' : 'tarefas'}</p></div>
    ${minhas.length ? `<div class="tasks">${minhas.map(t => cartaoTarefa(t, true)).join('')}</div>` : '<p class="hint">Nenhuma tarefa com os seus cargos.</p>'}</section>
  ${equipe.length ? `<section class="box"><div class="box-head"><h2>Na sua equipe</h2><p>Tarefas que estão com cargos abaixo do seu</p></div><div class="tasks">${equipe.map(t => cartaoTarefa(t, false)).join('')}</div></section>` : ''}
  ${alvos.length ? `<section class="box"><div class="box-head"><h2>Nova tarefa</h2><p>Para um cargo da sua área</p></div>
    <form id="t-nova" class="form-row" novalidate>
      <label class="f">O que fazer<input id="t-titulo" placeholder="Ex.: Trocar o filtro hidráulico da L3" autocomplete="off"></label>
      <label class="f">Para qual cargo<select id="t-cargo">${alvos.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label>
      <label class="f">Informação que ele precisa ver<select id="t-item">${ITENS.filter(i => p.dono || meusCargos(vendo).some(id => C(id).itens.includes(i.id))).map(i => `<option value="${i.id}">${i.nome}</option>`).join('')}</select></label>
      <label class="f">Prazo<input id="t-prazo" placeholder="dd/mm/aaaa" autocomplete="off"></label>
      <button class="btn primary" type="submit">Criar tarefa</button>
    </form></section>` : ''}`;
}

// ---------------------------------------------------------------- copiloto simulado: só responde com o que a pessoa recebeu
const INTENCOES = [
  {id:'custo', q:'Quanto perdi com paradas?', re:/(custo|perd|gast|dinheiro|r\$|preju)/i, precisa:['fin_custo'],
   r:(ac) => { const e = ac.fin_custo, v = ITEM('fin_custo').val(e); return `As paradas custaram entre <b>${v.v.replace(' a ', ' e ')}</b> (${ESCOPO[e].toLowerCase()}). A faixa existe porque o dataset não diz se várias falhas no mesmo dia são uma parada só.`; }},
  {id:'risco', q:'Qual máquina tem mais risco?', re:/(risco|vai parar|vai quebrar|prioridade|pior m)/i, precisa:['prev_chance', 'fin_risco'], algum:true,
   r:(ac) => { const e = ac.prev_chance || ac.fin_risco, k = maqs(e)[0], partes = [ac.prev_chance ? `${pct(M[k].chance)} de chance de falha` : '', ac.fin_risco ? `risco de <b>${brl(M[k].risco)} por dia</b>` : ''].filter(Boolean); return `${maqs(e).length > 1 ? 'A máquina com mais risco é a' : 'A sua máquina, a'} <b>${M[k].nome}</b>: ${partes.join(', ')}.`; }},
  {id:'prox', q:'Quando vem a próxima falha?', re:/(quando|próxima|proxima|horas)/i, precisa:['prev_proxima'],
   r:(ac) => maqs(ac.prev_proxima).map(k => `<b>${M[k].nome}</b>: ~${fmt(M[k].prox, 1)} h`).join(' · ') + '. É uma média do ritmo recente, não um horário exato.'},
  {id:'alerta', q:'Tem algum alerta agora?', re:/(alerta|sensor|press|hidr)/i, precisa:['man_alertas'],
   r:(ac) => maqs(ac.man_alertas).map(k => `<b>${M[k].nome}</b>: pressão hidráulica baixa em ${M[k].hp} dos últimos 30 registros`).join(' · ') + '. Abaixo de 101,7 bar o alerta dispara.'},
  {id:'tarefas', q:'Quais são as minhas tarefas?', re:/(tarefa|fazer|ação|acao|plano|primeiro)/i, precisa:[],
   r:() => { const l = comigo(vendo); return l.length ? l.map(t => `<b>${esc(t.titulo)}</b> (até ${t.prazo}, ${t.status})`).join(' · ') : 'Você não tem tarefas agora.'; }},
  {id:'dados', q:'Alguma máquina está sem enviar dados?', re:/(sem dados|enviando|leitura|conex)/i, precisa:['man_semdados'],
   r:(ac) => maqs(ac.man_semdados).map(k => `<b>${M[k].nome}</b>: ${M[k].semdados ? M[k].semdados + ' dias sem dados' : 'em dia'}`).join(' · ') + '.'},
  {id:'disp', q:'Como está a disponibilidade?', re:/(disponib|oee|funcionando)/i, precisa:['op_disp'],
   r:(ac) => `A disponibilidade está entre <b>${ITEM('op_disp').val(ac.op_disp).v.replace(' a ', ' e ')}</b> (${ESCOPO[ac.op_disp].toLowerCase()}), para uma meta de 90%.`}
];
function quemLibera(itemId) {
  const meus = meusCargos(vendo);
  const acima = [...new Set(meus.flatMap(ancestrais))].filter(id => C(id).itens.includes(itemId) && C(id).repassa);
  const pessoas = S.membros.filter(m => !m.dono && m.cargos.some(id => acima.includes(id))).map(m => m.nome);
  return [...pessoas, 'Você (dono)'].slice(0, 3).join(', ');
}
function responder(pergunta) {
  const ac = acesso(vendo), it = INTENCOES.find(x => x.re.test(pergunta));
  if (!it) return {txt:'Não encontrei essa informação nos blocos da sua tela. Tente uma das sugestões abaixo.', fontes:[]};
  const falta = it.precisa.filter(i => !(i in ac));
  if (it.precisa.length && (it.algum ? falta.length === it.precisa.length : falta.length)) return {negado:true, txt:`Essa informação não foi liberada para você (${falta.map(i => ITEM(i).nome).join(', ')}). Quem pode liberar: <b>${esc(quemLibera(falta[0]))}</b>.`, fontes:[]};
  return {txt: it.r(ac), fontes: it.id === 'tarefas' ? ['Tarefas'] : it.precisa.filter(i => i in ac).map(i => ITEM(i).nome)};
}
function telaCopiloto() {
  return `<div class="title"><h1>Copiloto IA</h1><p>Respondendo como <b>${esc(nomeVendo(vendo))}</b>. Simulação: no app, o DeepSeek escreve a resposta, mas só com os números dos blocos liberados. Ele nunca calcula.</p></div>
  <section class="box"><div class="chat">${chat.length ? chat.map(m => m.de === 'user' ? `<div class="msg user">${esc(m.txt)}</div>` : `<div class="msg bot${m.negado ? ' denied' : ''}"><span>${m.txt}</span>${m.fontes.length ? `<div class="src">${m.fontes.map(f => `<span>Fonte: ${f}</span>`).join('')}</div>` : ''}</div>`).join('') : '<p class="hint">Faça uma pergunta. Se a informação não foi liberada, o copiloto não responde e diz quem pode liberar.</p>'}</div>
    <div class="chips">${INTENCOES.map(x => `<button class="chip" type="button" data-perg="${x.id}">${x.q}</button>`).join('')}</div>
    <form id="ask" class="ask" novalidate><input id="ask-in" placeholder="Pergunte sobre as suas máquinas" autocomplete="off" aria-label="Pergunta"><button class="btn primary" type="submit">Enviar</button></form></section>`;
}
function perguntar(txt) { chat.push({de:'user', txt}); chat.push(Object.assign({de:'bot'}, responder(txt))); render(); }

function telaCardapio() {
  return `<div class="title"><h1>Cardápio de informações</h1><p>Tudo o que pode ser liberado por cargo: ${ITENS.length} informações em 8 pacotes. Cada uma explica de onde vem, a conta e o porquê. Valores das 3 máquinas juntas.</p></div>
  <div class="legend"><span><span class="pill ok">Dados atuais</span> calculado direto dos dados</span><span><span class="pill prem">Com premissa</span> usa uma premissa com fonte</span><span><span class="pill novo">Dado novo</span> a fábrica ainda não envia</span></div>
  ${PACOTES.map(pk => { const l = ITENS.filter(i => i.pac === pk.id); return `<section class="box"><div class="box-head"><h2>${pk.nome}</h2><p>${l.length} informações</p></div><div class="tiles">${l.map(i => { const r = i.val('all'); return `<article class="tile"><div class="tile-top"><b>${i.nome}</b><span class="pill ${i.st}">${PILL[i.st]}</span></div><div class="v">${r.v}</div><div class="s">${r.sub}</div>${como(i, r, true)}</article>`; }).join('')}</div></section>`; }).join('')}`;
}
function telaComo() {
  const passo = (t, x) => `<div class="box"><h2>${t}</h2><p>${x}</p></div>`;
  return `<div class="title"><h1>Como funciona</h1><p>O site não tem um painel fixo: ele monta a tela de cada pessoa com o que os cargos dela liberam.</p></div>
  <div class="steps">${passo('1. O dono cria os setores', 'Cada setor começa com um cargo de topo (ex.: Gerência, Financeiro), com as informações e máquinas daquele setor.')}${passo('2. Cada chefe monta a sua equipe', 'Quem tem um cargo que pode repassar cria cargos abaixo dele, dá esses cargos às pessoas e delega tarefas, sempre só com o que tem.')}${passo('3. A cadeia desce até o fim', 'O penúltimo nível ainda repassa para o último. Só o último nível fica sem repassar: ele executa.')}${passo('4. O site monta a tela', 'Cada pessoa vê só os blocos, gráficos e tarefas que recebeu. O copiloto responde só com isso.')}</div>
  <section class="box"><h2>As regras</h2><ol style="margin:0;padding-left:20px;display:grid;gap:4px"><li>Cada cargo fica abaixo de um cargo pai. O dono fica acima de todos.</li><li>Só dou o que tenho: um cargo só pode ter as informações e máquinas do cargo de cima.</li><li>Tirou de cima, sai de baixo: se o cargo de cima perde algo, todos abaixo perdem também.</li><li>Cada chefe só mexe nos cargos abaixo do seu, nunca nos de outro setor.</li><li>Tarefas descem pela cadeia: só delega quem está com a tarefa, para um cargo abaixo que veja a informação da tarefa.</li><li>Quem tem vários cargos vê a soma, cada informação só das máquinas que o cargo libera.</li><li>Tudo fica registrado. A IA nunca dá acesso sozinha.</li></ol></section>
  <section class="box"><h2>Por que dá para confiar nos números</h2><p>Todos os números saem de um programa fixo e testado. O copiloto (o DeepSeek do app) só lê os blocos liberados: ele nunca calcula e nunca vê o que não foi liberado. O dataset está sujo: 1.186 falhas são confirmadas pelos sensores, 68 são duvidosas e 11 têm erro de dado. Como ele não tem a hora de cada registro, custo, horas paradas e disponibilidade aparecem como faixa: o piso conta no máximo uma parada por dia por máquina e o teto conta cada registro como uma parada.</p></section>`;
}

// ---------------------------------------------------------------- eventos
const sujo = () => rascunho && JSON.stringify(rascunho) !== JSON.stringify(C(rascunho.id));
const editar = () => { if (!rascunho || rascunho.id !== cargoSel) rascunho = JSON.parse(JSON.stringify(C(cargoSel))); return rascunho; };
const bloqueado = () => { if (sujo()) { toast('Salve ou desfaça as mudanças do cargo antes de sair dele.'); return true; } return false; };
function novoCargo(pai) {
  const id = 'c' + Date.now().toString(36), base = pai ? C(pai) : null;
  S.cargos.push({id, pai, nome: pai ? `abaixo de ${base.nome}` : 'novo setor', cor:'#95a5a6', itens:[], maqs: base ? [...base.maqs] : [...TUDO], repassa:true});
  cargoSel = id; aba = 'perm'; rascunho = null; salvar(); render();
  toast(pai ? 'Cargo criado abaixo. Ligue o que ele vê (só o que o cargo de cima tem) e salve.' : 'Setor criado no topo. Ligue o que ele vê e salve.');
}

document.addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.view) { if (bloqueado()) return; view = d.view; rascunho = null; render(); return; }
  if (d.ver) { if (bloqueado()) return; vendo = d.ver; view = 'visao'; chat = []; rascunho = null; render(); window.scrollTo(0, 0); return; }
  if (d.cargo) { if (d.cargo !== cargoSel && bloqueado()) return; cargoSel = d.cargo; rascunho = null; render(); return; }
  if (d.aba) { aba = d.aba; render(); return; }
  if (d.membro) { membroSel = d.membro; render(); return; }
  if (d.vercargo) { if (bloqueado()) return; vendo = 'cargo:' + d.vercargo; view = 'visao'; chat = []; rascunho = null; render(); window.scrollTo(0, 0); return; }
  if (d.vermembro) { vendo = d.vermembro; view = 'visao'; chat = []; render(); window.scrollTo(0, 0); return; }
  if (d.perg) { perguntar(INTENCOES.find(x => x.id === d.perg).q); return; }
  if (d.sw) {
    const r = editar();
    if (d.sw === 'repassa') r.repassa = !r.repassa;
    else if (d.sw.startsWith('maq:')) { const k = d.sw.slice(4); r.maqs = r.maqs.includes(k) ? r.maqs.filter(x => x !== k) : [...r.maqs, k]; }
    else r.itens = r.itens.includes(d.sw) ? r.itens.filter(x => x !== d.sw) : [...r.itens, d.sw];
    render(); return;
  }
  if (d.cor) { editar().cor = d.cor; render(); return; }
  if (d.tirar) { const m = MB(d.tirar); m.cargos = m.cargos.filter(x => x !== cargoSel); salvar(); render(); toast(`${m.nome} saiu do cargo.`); return; }
  if (d.tirarcargo) { const m = MB(membroSel), nome = C(d.tirarcargo).nome; m.cargos = m.cargos.filter(x => x !== d.tirarcargo); salvar(); render(); toast(`${m.nome} perdeu o cargo ${nome}.`); return; }
  if (d.delegar) {
    const tf = S.tarefas.find(x => x.id === d.delegar), dest = document.querySelector(`[data-dest="${tf.id}"]`).value;
    if (!destinos(vendo, tf).includes(dest)) { toast('Você só delega para um cargo abaixo que veja a informação da tarefa.'); return; }
    tf.cargo = dest; tf.cadeia.push(dest); salvar(); render(); toast(`Tarefa delegada para ${C(dest).nome}.`); return;
  }
  switch (t.id) {
    case 'r-criar': if (!bloqueado()) novoCargo(cargoSel); return;
    case 'r-criar-topo': if (!bloqueado()) novoCargo(null); return;
    case 'r-salvar': {
      const i = S.cargos.findIndex(c => c.id === rascunho.id); if (rascunho.nome.trim() === '') { toast('Dê um nome ao cargo.'); return; }
      const lim = limiteDe(rascunho); rascunho.itens = rascunho.itens.filter(x => lim.itens.includes(x)); rascunho.maqs = rascunho.maqs.filter(x => lim.maqs.includes(x));
      S.cargos[i] = rascunho; rascunho = null; const perdas = cascata(); salvar(); render();
      toast(perdas.length ? `Salvo. Em cascata: ${perdas.join('; ')}.` : 'Cargo salvo.'); return;
    }
    case 'r-reset': rascunho = null; render(); return;
    case 'r-excluir': {
      // os cargos de baixo sobem para o pai do cargo excluído e se ajustam ao que ele tem
      const c = C(cargoSel); filhosC(c.id).forEach(f => { f.pai = c.pai; });
      S.cargos = S.cargos.filter(x => x.id !== c.id); S.membros.forEach(m => { m.cargos = m.cargos.filter(x => x !== c.id); });
      S.tarefas.forEach(tf => { if (tf.cargo === c.id) tf.cargo = c.pai || tf.cadeia[0]; });
      cargoSel = c.pai || S.cargos[0].id; rascunho = null; const perdas = cascata(); salvar(); render(); toast(`Cargo ${c.nome} excluído. Quem estava abaixo subiu um nível.${perdas.length ? ' ' + perdas.join('; ') + '.' : ''}`); return;
    }
    case 'r-addbtn': { const m = MB(document.getElementById('r-add').value); m.cargos.push(cargoSel); salvar(); render(); toast(`${m.nome} recebeu o cargo ${C(cargoSel).nome}.`); return; }
    case 'm-darcargo': { const m = MB(membroSel), id = document.getElementById('m-cargo').value; m.cargos.push(id); salvar(); render(); toast(`${m.nome} recebeu o cargo ${C(id).nome}.`); return; }
    case 'm-remover': { const m = MB(membroSel); S.membros = S.membros.filter(x => x.id !== m.id); membroSel = 'm0'; salvar(); render(); toast(`${m.nome} saiu da empresa.`); return; }
    case 'reset': S = EXEMPLO(); vendo = 'm0'; view = 'visao'; cargoSel = 'g1'; rascunho = null; chat = []; salvar(); render(); toast('Exemplo restaurado.'); return;
  }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'r-nome') { editar().nome = ev.target.value; if (!document.querySelector('.dc-save')) { const p = ev.target.selectionStart; render(); const el = document.getElementById('r-nome'); el.focus(); el.setSelectionRange(p, p); } }
  if (ev.target.id === 'r-busca') { busca = ev.target.value; const p = ev.target.selectionStart; render(); const el = document.getElementById('r-busca'); el.focus(); el.setSelectionRange(p, p); }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'tb-pessoa') { if (bloqueado()) { t.value = ''; return; } if (t.value) { vendo = t.value; view = 'visao'; chat = []; rascunho = null; render(); window.scrollTo(0, 0); } return; }
  if (t.dataset.status) { const tf = S.tarefas.find(x => x.id === t.dataset.status); tf.status = t.value; salvar(); render(); toast(`Status: ${t.value}.`); }
});
document.addEventListener('submit', ev => {
  ev.preventDefault();
  if (ev.target.id === 'ask') { const q = document.getElementById('ask-in').value.trim(); if (q) perguntar(q); return; }
  if (ev.target.id === 'm-novo') {
    const nome = document.getElementById('m-nome').value.trim(); if (!nome) { toast('Escreva o nome de quem vai entrar.'); return; }
    const id = 'm' + Date.now().toString(36); S.membros.push({id, nome, cargos:[]}); membroSel = id; salvar(); render(); toast(`${nome} entrou na empresa, ainda sem cargo. Dê um cargo da sua área.`); return;
  }
  if (ev.target.id === 't-nova') {
    const titulo = document.getElementById('t-titulo').value.trim(), cargo = document.getElementById('t-cargo').value, item = document.getElementById('t-item').value, prazo = document.getElementById('t-prazo').value.trim() || 'sem prazo';
    if (!titulo) { toast('Escreva o que precisa ser feito.'); return; }
    if (!C(cargo).itens.includes(item)) { toast(`${C(cargo).nome} não vê "${ITEM(item).nome}". Escolha outra informação ou outro cargo.`); return; }
    S.tarefas.push({id:'t' + Date.now().toString(36), titulo, item, prazo, status:'a fazer', cargo, cadeia:[...ancestrais(cargo).reverse().filter(id => poder(vendo).dono || poder(vendo).gerencia.includes(id) || meusCargos(vendo).includes(id)), cargo]});
    salvar(); render(); toast(`Tarefa criada para ${C(cargo).nome}.`);
  }
});
