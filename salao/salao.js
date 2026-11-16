/* Sistema de agendamento para salões. A marca vem de marca.js. Ver README.md e CLAUDE.md. */
"use strict";
/* PAINEL DO SALÃO (dona): pedidos para aprovar, resumo do pedido com comprovante, agenda, financeiro com fechamento de caixa,
   serviços e categorias, equipe. Usa comum/nucleo.js e comum/dados.js. */
function receipt(b) {
  if (b.receipt) return b.receipt;
  const c = document.createElement("canvas"); c.width = 600; c.height = 940;
  const x = c.getContext("2d");
  x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, 600, 940);
  x.fillStyle = "#009EE3"; x.fillRect(0, 0, 600, 96);
  x.fillStyle = "#FFFFFF"; x.font = "bold 30px Montserrat, Arial"; x.fillText("Comprovante de Pix", 36, 60);
  x.fillStyle = "#555"; x.font = "500 22px Montserrat, Arial"; x.fillText("Valor", 36, 150);
  x.fillStyle = "#111"; x.font = "bold 54px Montserrat, Arial"; x.fillText(fmt(sum(b.itens)), 36, 212);
  const pago = (b.hist.find(h => h[2].startsWith("Pix confirmado")) || ["--"])[0];
  const rows = b.pix   /* dados do pagamento no Mercado Pago, vindos do servidor */
    ? [["Data", dayLabel(b.pix.dia) + " · " + b.pix.hora], ["De", b.pix.pagador || b.nome], ["Valor pago", fmt(b.pix.valor)], ["Para", MARCA.nomeCompleto], ["Instituição", "Mercado Pago"], ["Tipo", "Pix"], ["ID da transação", b.pix.mpId || "--"]]
    : [["Data", dayLabel(HOJE) + " · " + pago], ["De", b.nome], ["CPF", "***.482.***-**"], ["Para", MARCA.nomeCompleto], ["Instituição", "Mercado Pago"], ["Tipo", "Pix"], ["ID da transação", "E1835200" + (20261113000 + b.id) + "x7k"]];
  let y = 290;
  rows.forEach(([k, v]) => { x.fillStyle = "#777"; x.font = "500 20px Montserrat, Arial"; x.fillText(k, 36, y); x.fillStyle = "#111"; x.font = "600 23px Montserrat, Arial"; x.fillText(v, 36, y + 32); x.fillStyle = "#EEE"; x.fillRect(36, y + 52, 528, 2); y += 84; });
  const selo = b.ex ? "EXEMPLO" : b.pix ? (b.pix.teste ? "PIX DE TESTE · sem dinheiro de verdade" : "") : "EXEMPLO · protótipo";
  if (selo) { x.fillStyle = "#B5453A"; x.font = "bold 20px Montserrat, Arial"; x.fillText(selo, 36, 905); }
  b.receipt = c.toDataURL("image/png");
  return b.receipt;
}

/* ===== PAINEL DO SALÃO ===== */
/* concluir: por enquanto a dona marca no painel. Com o acesso por colaboradora (ver docs/FUTURO-ACESSO-COLABORADORAS.md),
   a própria profissional conclui os atendimentos dela. */
const podeConcluir = b => b.status === "aprovado" && !DADOS.servidor;   /* com servidor: entra quando a rota /concluir existir (docs/ENTREGA-VPS.md) */
function vEntrar() {
  return `<section class="view">
    <div class="top"><img src="${LOGO}" alt="${esc(MARCA.nome)}"><div class="top-r"><span class="eyebrow">Painel</span><b>Acesso do salão</b></div></div>
    <div class="card sec" style="margin-top:28px"><span class="eyebrow">Entrar no painel</span>
      <label class="field">Usuário<input type="text" id="lg-login" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
      <label class="field">Senha<input type="password" id="lg-senha" autocomplete="current-password"></label>
      <button class="btn full" type="button" id="lg-entrar">Entrar</button>
      <p class="meta">Acesso só da dona do salão e de quem ela autorizar.</p></div>
  </section>`;
}
function entrarPainel() {
  const l = document.getElementById("lg-login"), sn = document.getElementById("lg-senha");
  if (!l || !l.value.trim() || !sn.value) { toast("Preencha o usuário e a senha."); return; }
  fazer(() => DADOS.entrarSalao(l.value.trim().toLowerCase(), sn.value), () => { S.tab = "pedidos"; window.scrollTo(0, 0); });
}
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target && e.target.id === "lg-senha") entrarPainel(); });
function topSalao() {
  return `<div class="top"><img src="${LOGO}" alt="${esc(MARCA.nome)}"><div class="top-r"><span class="eyebrow">Painel</span><b>${dayShort(HOJE)}</b></div></div>`;
}
function vPedidos() {
  const list = S.bookings.filter(b => b.status === "aguardando").sort((a, b) => a.id - b.id);
  const conf = S.bookings.filter(b => naAgenda(b) && b.day === HOJE);
  return `<section class="view">
    ${topSalao()}
    <div class="ink-stats"><div><b class="g">${list.length}</b><span>para aprovar</span></div><div><b>${conf.length}</b><span>confirmados hoje</span></div><div><b>${fmt0(conf.reduce((a, b) => a + sum(b.itens), 0))}</b><span>previsto hoje</span></div></div>
    <div class="row pad-x" style="margin-top:6px;align-items:baseline"><h1 style="font-size:24px">Para aprovar</h1><span class="meta">mais antigos primeiro</span></div>
    ${list.length ? list.map(b => {
      const pago = b.pay === "pix" && b.paid;
      return `<article class="card ocard">
        <button class="ohead" type="button" data-open="${b.id}">${ava(fotoDe(b), b.nome, "md")}<span style="min-width:0"><h3>${esc(b.nome)}${b.ex ? ` <span class="tag-ex">Ex.</span>` : ""}</h3><p>${esc(nomes(b.itens))} · ${esc(pro(b.pro).nome)}</p></span><span class="pill ${pago ? "ok" : "n"}">${pago ? "Pix pago" : "No salão"}</span></button>
        <div class="ostrip"><span>${dayLabel(b.day)} · ${b.time}</span><span>${fmt(sum(b.itens))}${b.pay === "salao" ? " · " + payWord(b) : ""}</span></div>
        <div class="obtns"><button class="btn bad" type="button" data-rej="${b.id}">Reprovar</button><button class="btn" type="button" data-apr="${b.id}">Aprovar</button></div>
      </article>`;
    }).join("") : `<div class="empty">Nenhum pedido esperando. Os novos aparecem aqui.</div>`}
  </section>`;
}
function vDetalhe() {
  const b = bk(S.detail), wa = "https://wa.me/55" + b.fone.replace(/\D/g, ""), nome1 = b.nome.split(" ")[0];
  const m = t => wa + "?text=" + encodeURIComponent(t);
  const status = b.status === "concluido" ? `<div class="status-box ok">✓ Atendimento concluído${b.concluidoPor ? " por " + esc(b.concluidoPor) : ""}</div>`
    : b.status === "aprovado" ? `<div class="status-box ok">✓ Agendamento confirmado</div>`
    : b.status === "reprovado" ? `<div class="status-box bad">Não aprovado${b.motivo ? ": " + esc(b.motivo) : ""}.${b.refund ? " Pix devolvido à cliente." : ""}</div>`
    : `<div class="status-box warn">Esperando a sua aprovação</div>`;
  return `<section class="view">
    ${navBack('data-fechar="1"', "Pedido #" + b.id)}
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding-top:6px">${ava(fotoDe(b), b.nome, "xl", "ring")}<h1 style="font-size:24px">${esc(b.nome)}</h1>${b.ex ? `<span class="tag-ex">Exemplo</span>` : ""}</div>
    ${status}
    <div class="card sec"><span class="eyebrow">Cliente</span>
      <div class="kv dim"><span>Nome</span><span>${esc(b.nome)}</span></div>
      <div class="kv dim"><span>WhatsApp</span><span>${esc(b.fone)}</span></div>
      <div class="kv dim"><span>Endereço</span><span>${esc(b.end || "Não informado")}</span></div></div>
    <div class="card sec"><span class="eyebrow">Serviço</span>
      ${b.itens.map(k => `<div class="kv"><span>${esc(it(k).nome)} · ${dur(it(k).min)}</span><span>${fmt(it(k).preco)}</span></div>`).join("")}
      <div class="kv dim"><span>Quando</span><span>${dayLabel(b.day)} · ${b.time} às ${toHM(toMin(b.time) + mins(b.itens))}</span></div>
      <div class="kv dim"><span>Profissional</span><span>${esc(pro(b.pro).nome)}</span></div>
      ${b.obs ? `<div class="obs"><b>Observação da cliente</b>${esc(b.obs)}</div>` : ""}</div>
    <div class="card sec"><span class="eyebrow">Pagamento</span>
      <div class="kv dim"><span>Forma</span><span>${b.pay === "pix" ? "Pix (pago no app)" : "No salão · " + (b.payIn === "dinheiro" ? "dinheiro" : "cartão de crédito")}</span></div>
      <div class="kv dim"><span>Situação</span><span>${b.pay === "pix" ? (b.refund ? "Pix devolvido" : "Pix confirmado") : "Paga no dia"}</span></div>
      <div class="kv total"><span>Total</span><span>${fmt(sum(b.itens))}</span></div>
      ${b.pay === "pix" && b.paid ? `<button class="receipt-thumb" type="button" data-zoom="${b.id}"><img src="${receipt(b)}" alt="Comprovante do Pix"><span>Ver comprovante<small>Toque para abrir e dar zoom</small></span></button>` : ""}</div>
    <div class="card sec"><span class="eyebrow">Mensagem à cliente</span>
      <div class="msgs">
        <a href="${m("Oi, " + nome1 + "! Seu horário no " + MARCA.nome + " está confirmado para " + dayLabel(b.day) + " às " + b.time + ". Te esperamos!")}" target="_blank" rel="noopener">Confirmar horário</a>
        <a href="${m("Oi, " + nome1 + "! Passando para lembrar do seu horário às " + b.time + " no " + MARCA.nome + ".")}" target="_blank" rel="noopener">Lembrete</a>
        <a href="${m("Oi, " + nome1 + "! Precisamos remarcar o seu horário. Qual outro dia fica bom para você?")}" target="_blank" rel="noopener">Remarcar</a>
        <a href="${m("Oi, " + nome1 + "! Vamos atrasar uns minutinhos, já te chamamos.")}" target="_blank" rel="noopener">Vai atrasar</a>
        <a class="wide" href="${wa}" target="_blank" rel="noopener">Escrever mensagem livre</a></div>
      <p class="meta">Abre o WhatsApp com a mensagem pronta para ${esc(b.fone)}.</p></div>
    <div class="card sec hist"><span class="eyebrow">Histórico</span>${b.hist.slice().reverse().map(h => `<div class="kv"><span>${h[0]} · ${h[1]}</span><span>${esc(h[2])}</span></div>`).join("")}</div>
    ${b.status === "aguardando" ? `<div class="obtns"><button class="btn bad" type="button" data-rej="${b.id}">Reprovar</button><button class="btn" type="button" data-apr="${b.id}">Aprovar</button></div>` : ""}
    ${podeConcluir(b) ? `<button class="btn full btn-ok" type="button" data-concluir="${b.id}">${IC.check}Concluir atendimento</button><p class="meta" style="text-align:center">Depois de concluído, a cliente recebe o convite para avaliar.</p>` : ""}
  </section>`;
}
function livreMin(day, proId) {
  const ps = proId === "todas" ? PROS : [pro(proId)];
  if (!aberto(day) && day !== HOJE) return 0;
  return ps.reduce((acc, p) => {
    const ocup = S.bookings.filter(b => b.pro === p.id && b.day === day && (naAgenda(b) || b.status === "aguardando")).reduce((a, b) => a + mins(b.itens), 0);
    return acc + Math.max(0, toMin(p.fim) - toMin(p.ini) - ocup);
  }, 0);
}
function vAgenda() {
  const dias = weekDays(0);
  const day = S.aDay;
  let list = S.bookings.filter(b => naAgenda(b) && b.day === day);
  if (S.aPro !== "todas") list = list.filter(b => b.pro === S.aPro);
  list.sort((a, b) => a.time.localeCompare(b.time));
  const rows = []; list.forEach((b, i) => {
    rows.push(b);
    const fim = toMin(b.time) + mins(b.itens), prox = list[i + 1];
    if (prox && toMin(prox.time) - fim >= 30) rows.push({ gap: true, de: toHM(fim), ate: prox.time });
  });
  return `<section class="view">
    <div class="row pad-x" style="margin-top:12px;align-items:baseline"><h1>Agenda</h1><span class="meta">${MES[dOf(day).getMonth()][0].toUpperCase() + MES[dOf(day).getMonth()].slice(1)}</span></div>
    <div class="card" style="padding:10px"><div class="week" role="group">${dias.map(k => { const d = dOf(k), tem = S.bookings.some(b => b.day === k && naAgenda(b));
      return `<button class="wd" type="button" data-aday="${k}" ${aberto(k) ? "" : "disabled"} aria-pressed="${k === day}">${WD[d.getDay()]}<b>${d.getDate()}</b><i class="${tem ? "on" : ""}"></i></button>`; }).join("")}</div></div>
    <div class="gmini"><div><span>Atendimentos</span><b>${list.length}</b></div><div><span>Previsto</span><b>${fmt0(list.reduce((a, b) => a + sum(b.itens), 0))}</b></div><div><span>${S.aPro === "todas" ? "Livre / prof." : "Livre"}</span><b>${dur(Math.round(livreMin(day, S.aPro) / (S.aPro === "todas" ? Math.max(1, PROS.length) : 1) / 15) * 15).replace(" min", "min")}</b></div></div>
    <div class="chips" role="group" aria-label="Filtrar por profissional"><button class="chip" type="button" data-apro="todas" aria-pressed="${S.aPro === "todas"}">Todas</button>${PROS.map(p => `<button class="chip" type="button" data-apro="${p.id}" aria-pressed="${S.aPro === p.id}"><span class="dot" style="background:${p.cor}"></span>${esc(p.nome)}</button>`).join("")}</div>
    ${rows.length ? rows.map(r => r.gap
      ? `<div class="tl"><time>${r.de}</time><div class="gap"><span>Livre até ${r.ate}</span><button class="link" type="button" data-encaixe="${r.de}">+ Encaixe</button></div></div>`
      : `<div class="tl"><time>${r.time}<small>${toHM(toMin(r.time) + mins(r.itens))}</small></time><div class="stack" style="gap:6px"><button class="card acard ${r.status === "concluido" ? "feito" : ""}" type="button" data-open="${r.id}"><span class="bar3" style="background:${pro(r.pro).cor}"></span><span style="min-width:0"><h3>${esc(r.nome)}</h3><p>${esc(nomes(r.itens))} · ${esc(pro(r.pro).nome)}</p><span class="pill ${r.pay === "pix" ? "ok" : "n"}">${r.pay === "pix" ? "Pix pago" : payWord(r)} · ${fmt0(sum(r.itens))}</span></span>${ava(pro(r.pro).foto, pro(r.pro).nome, "sm")}</button>${r.status === "concluido" ? `<span class="feito-tag">${IC.check}Concluído</span>` : podeConcluir(r) ? `<button class="btn soft btn-concluir" type="button" data-concluir="${r.id}">${IC.check}Concluir atendimento</button>` : ""}</div></div>`).join("")
      : `<div class="empty">Nenhum atendimento confirmado nesse dia${S.aPro !== "todas" ? " para " + esc(pro(S.aPro).nome) : ""}.</div>`}
  </section>`;
}
const FORMAS = { pix: ["Pix", "#4FC1B3"], cartao: ["Cartão", "#D9B56F"], dinheiro: ["Dinheiro", "#9DBF92"] };
const ltile = f => f === "pix" ? `<span class="ltile pix"><i></i></span>` : f === "cartao" ? `<span class="ltile cartao"><span class="minicard"></span></span>` : `<span class="ltile dinheiro">R$</span>`;
function vFinanceiro() {
  const dia = S.lanc.filter(l => l.day === S.finDay), tot = dia.reduce((a, l) => a + l.valor, 0);
  const porForma = f => dia.filter(l => l.forma === f).reduce((a, l) => a + l.valor, 0);
  const list = (S.finF === "todos" ? dia : dia.filter(l => l.forma === S.finF)).slice().sort((a, b) => a.at.localeCompare(b.at));
  const opts = Array.from({ length: 7 }, (_, i) => addDays(HOJE, -i));
  const cx = S.caixas[S.finDay];
  return `<section class="view">
    <div class="row pad-x" style="margin-top:12px"><h1>Financeiro</h1><select class="datesel" id="fin-dia" aria-label="Dia">${opts.map((k, i) => `<option value="${k}" ${k === S.finDay ? "selected" : ""}>${i === 0 ? "Hoje, " + dOf(k).getDate() + " " + MES[dOf(k).getMonth()].slice(0, 3) : dayShort(k)}</option>`).join("")}</select></div>
    <div class="fin"><span class="eyebrow">Faturamento do dia</span><span class="big">${fmt(tot)}</span><small>${dia.length} ${dia.length === 1 ? "lançamento" : "lançamentos"} · atualizado ao aprovar</small>
      ${Object.keys(FORMAS).map(f => { const v = porForma(f); return `<div class="fbar"><div class="row"><span>${FORMAS[f][0]}</span><b>${fmt(v)}</b></div><div class="track"><i style="width:${tot ? Math.round(v / tot * 100) : 0}%;background:${FORMAS[f][1]}"></i></div></div>`; }).join("")}
    </div>
    <div class="chips" role="group" aria-label="Filtrar por forma"><button class="chip" type="button" data-finf="todos" aria-pressed="${S.finF === "todos"}">Todos</button>${Object.keys(FORMAS).map(f => `<button class="chip" type="button" data-finf="${f}" aria-pressed="${S.finF === f}">${FORMAS[f][0]}</button>`).join("")}</div>
    ${cx ? `<div class="closed">${IC.lock}Caixa fechado às ${cx.at} · ${fmt(cx.total)}</div>` : ""}
    ${list.length ? `<div class="card" style="padding:4px 16px">${list.map(l => `<div class="lanc">${ltile(l.forma)}<span style="min-width:0"><h3>${esc(l.nome)}${l.ex ? ` <span class="tag-ex">Ex.</span>` : ""}</h3><p>${esc(nomes(l.itens))} · aprovado ${l.at}</p></span><b>+ ${fmt(l.valor)}</b></div>`).join("")}</div>`
      : `<div class="empty">Nenhum pagamento ${S.finF === "todos" ? "" : "em " + FORMAS[S.finF][0].toLowerCase() + " "}nesse dia.</div>`}
  </section>`;
}
function fFinanceiro() {
  const cx = S.caixas[S.finDay], tem = S.lanc.some(l => l.day === S.finDay);
  if (cx) return `<div class="goldcta"><button type="button" disabled>${IC.lock}Caixa do dia fechado</button></div>`;
  return `<div class="goldcta"><button type="button" id="fechar-caixa" ${tem ? "" : "disabled"}>${IC.lock}Fechar caixa do dia</button></div>`;
}

const CAT_IC = {};
const thumb = s => `<span class="thumb">${s.foto ? `<img src="${s.foto}" alt="">` : esc((s.cat || "✦")[0])}</span>`;
function vServicos() {
  const vis = SERVICES.filter(s => s.disp !== "arquivado"), ativos = vis.filter(s => s.disp === "disponivel").length;
  return `<section class="view">
    <div class="pad-x" style="margin-top:12px"><h1>Serviços</h1><p class="meta" style="margin-top:4px">${ativos} ativos · toque num serviço para editar</p></div>
    <div class="obtns" style="grid-template-columns:2fr 1fr"><button class="btn" type="button" data-svcedit="novo">+ Novo serviço</button><button class="btn ghost" type="button" id="abrir-cats">Categorias</button></div>
    ${CATS.map(c => { const l = vis.filter(s => s.cat === c); return `<div class="sec"><span class="eyebrow pad-x">${esc(c)} (${l.length})</span>${l.length ? l.map(s => `<div class="card svc-adm">
      <button class="svc-open" type="button" data-svcedit="${s.id}">${thumb(s)}<span><b>${esc(s.nome)}${s.disp === "pausado" ? `<span class="tag-off">Pausado</span>` : s.disp === "oculto" ? `<span class="tag-off">Oculto</span>` : ""}</b><small>${s.opcoes.length ? "a partir de " + fmt(desde(s)) + " · " + s.opcoes.length + " opções" : fmt(s.preco) + " · " + dur(s.min)}</small></span></button>
      <button class="toggle" type="button" data-tog="${s.id}" aria-pressed="${s.disp === "disponivel"}" aria-label="${esc(s.nome)} disponível hoje"></button></div>`).join("") : `<div class="empty" style="padding:16px">Nenhum serviço em ${esc(c)}.</div>`}</div>`; }).join("")}
  </section>`;
}
const MINS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];
function vSvcEdit() {
  const e = S.sdraft, novo = e.id === "novo";
  return `<section class="view">
    ${navBack('data-svcfechar="1"', novo ? "Novo serviço" : "Editar serviço")}
    <div class="card" style="display:flex;flex-direction:column;align-items:center;gap:10px">
      <span class="thumb big">${e.foto ? `<img src="${e.foto}" alt="">` : esc((e.cat || "✦")[0])}</span>
      <div class="row" style="gap:8px"><button class="btn ghost" type="button" id="svc-foto">${e.foto ? "Trocar foto" : "Adicionar foto"}</button>${e.foto ? `<button class="btn bad" type="button" id="svc-rmfoto">Remover</button>` : ""}</div>
      <p class="meta">Sem foto, aparece a inicial da categoria.</p></div>
    <div class="card sec">
      <label class="field">Nome<input type="text" id="e-nome" value="${esc(e.nome)}" placeholder="Ex.: Progressiva"></label>
      <label class="field">Descrição<textarea id="e-desc" placeholder="O que está incluso">${esc(e.desc)}</textarea></label>
      <div class="row" style="gap:10px;align-items:flex-start"><label class="field" style="flex:1">Preço (R$)<input type="number" min="0" step="5" id="e-preco" value="${e.preco}"></label>
        <label class="field" style="flex:1">Duração<select id="e-min">${MINS.map(m => `<option value="${m}" ${+e.min === m ? "selected" : ""}>${dur(m)}</option>`).join("")}</select></label></div>
      <div class="row" style="gap:10px;align-items:flex-start"><label class="field" style="flex:1">Categoria<select id="e-cat">${CATS.map(c => `<option ${e.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <label class="field" style="flex:1">Disponibilidade<select id="e-disp"><option value="disponivel" ${e.disp === "disponivel" ? "selected" : ""}>Disponível</option><option value="pausado" ${e.disp === "pausado" ? "selected" : ""}>Pausado hoje</option><option value="oculto" ${e.disp === "oculto" ? "selected" : ""}>Oculto (rascunho)</option></select></label></div>
      <p class="meta">Quem faz: ${PROS.filter(p => p.cats.includes(e.cat)).map(p => esc(p.nome)).join(", ") || "ninguém da equipe atende essa categoria ainda"}.</p></div>
    <div class="card sec"><span class="eyebrow">Opções com preço e tempo próprios</span><p class="meta">Ex.: cabelo curto, médio e longo. Sem opções, vale o preço e a duração acima.</p>
      ${e.opcoes.map((o, i) => `<div class="optrow"><span>${esc(o.nome)}<small>${dur(o.min)}</small></span><b>${fmt(o.preco)}</b><button class="xbtn" type="button" data-rmopt="${i}" aria-label="Remover ${esc(o.nome)}">✕</button></div>`).join("")}
      ${S.novaOpt ? `<div class="sec" style="border-top:1px solid var(--line-2);padding-top:10px"><label class="field">Nome da opção<input type="text" id="o-nome" placeholder="Ex.: longo"></label>
          <div class="row" style="gap:10px"><label class="field" style="flex:1">Preço (R$)<input type="number" min="0" step="5" id="o-preco" value="${e.preco}"></label><label class="field" style="flex:1">Duração<select id="o-min">${MINS.map(m => `<option value="${m}" ${+e.min === m ? "selected" : ""}>${dur(m)}</option>`).join("")}</select></label></div>
          <div class="obtns" style="grid-template-columns:1fr 1fr"><button class="btn ghost" type="button" data-optcancel="1">Cancelar</button><button class="btn" type="button" id="opt-ok">Adicionar opção</button></div></div>`
        : `<button class="btn ghost full" type="button" id="opt-add">+ Opção</button>`}</div>
    <button class="btn full" type="button" id="svc-salvar">${novo ? "Publicar serviço" : "Salvar alterações"}</button>
    ${novo ? "" : `<div class="obtns" style="grid-template-columns:1fr 1fr"><button class="btn ghost" type="button" id="svc-dup">Duplicar</button><button class="btn bad" type="button" id="svc-arq">Arquivar</button></div><p class="meta">Arquivar tira o serviço do app, mas mantém o histórico dos agendamentos antigos.</p>`}
  </section>`;
}
function vCats() {
  return `<section class="view">
    ${navBack('data-catsfechar="1"', "Categorias")}
    <p class="meta pad-x">São as abas que a cliente vê no app e as especialidades da equipe.</p>
    ${CATS.map((c, i) => { const n = SERVICES.filter(s => s.cat === c && s.disp !== "arquivado").length; return `<div class="card row" style="padding:10px 12px">
      <input type="text" id="cat-${i}" data-catidx="${i}" value="${esc(c)}" aria-label="Nome da categoria" style="flex:1"><span class="meta" style="white-space:nowrap">${n} serv.</span><button class="xbtn" type="button" data-rmcat="${i}" aria-label="Excluir ${esc(c)}">✕</button></div>`; }).join("")}
    <div class="card row" style="padding:10px 12px"><input type="text" id="cat-nova" placeholder="Nova categoria (ex.: Depilação)" style="flex:1"><button class="btn" type="button" id="cat-add">Adicionar</button></div>
  </section>`;
}
/* alerta de atenção: avaliações ruins recentes (últimos 30 dias) */
function desempenho(p) {
  const l = avalDe(p.id), rec = l.filter(a => diasAtras(a.dia) <= 30), ant = l.filter(a => diasAtras(a.dia) > 30);
  const neg = rec.filter(a => a.nota <= 2).length;
  return { l, rec, ant, neg, m: media(l), m30: media(rec), mAnt: media(ant), alerta: neg >= 2 || (rec.length >= 3 && media(rec) < 3.5) };
}
function vEquipe() {
  const atencao = PROS.filter(p => desempenho(p).alerta);
  return `<section class="view">
    <div class="row pad-x" style="margin-top:12px;align-items:baseline"><h1>Equipe</h1><span class="meta">${PROS.length} profissionais</span></div>
    <p class="meta pad-x">Toque numa profissional para ver as avaliações das clientes, o desempenho e o acompanhamento (PDI).</p>
    ${atencao.map(p => { const D = desempenho(p); return `<button class="alerta" type="button" data-proview="${p.id}"><i>!</i><span><b>Atenção com ${esc(p.nome)}</b>${D.neg} ${D.neg === 1 ? "avaliação ruim" : "avaliações ruins"} nos últimos 30 dias · nota recente ${nota1(D.m30)}</span><em>Ver →</em></button>`; }).join("")}
    <button class="btn full" type="button" data-proedit="novo">+ Adicionar profissional</button>
    ${PROS.length ? `<div class="tgrid">${PROS.map(p => { const n = S.bookings.filter(b => b.pro === p.id && naAgenda(b) && b.day === HOJE).length, D = desempenho(p);
      return `<button class="card tcard ${D.alerta ? "warn" : ""}" type="button" data-proview="${p.id}">${D.alerta ? `<span class="tflag">Atenção</span>` : ""}${ava(p.foto, p.nome, "lg")}<b><span class="dot" style="background:${p.cor};margin-right:6px"></span>${esc(p.nome)}</b>${resumoNota(p)}<small>${esc(p.faz || p.cats.join(", "))}</small><span class="meta" style="color:var(--gold);font-weight:600">${p.ini.slice(0, 2)}h–${p.fim.slice(0, 2)}h · ${n} hoje</span></button>`; }).join("")}</div>`
      : `<div class="empty">Nenhuma profissional cadastrada. Adicione a primeira para abrir a agenda.</div>`}
    ${DADOS.servidor ? `<button class="btn ghost full" type="button" id="sair-painel">Sair do painel</button>` : ""}
  </section>`;
}
const PDI_TIPOS = ["Conversa de alinhamento", "Treinamento", "Acompanhamento no atendimento", "Elogio / reconhecimento"];
function vProPerfil() {
  const p = pro(S.proView), D = desempenho(p);
  const filtro = S.avFiltro || "todas";
  const lista = D.l.filter(a => filtro === "todas" || (filtro === "neg" ? a.nota <= 3 : a.nota >= 4)).sort((a, b) => b.dia.localeCompare(a.dia));
  const contTags = {}; D.l.forEach(a => a.tags.forEach(x => contTags[x] = (contTags[x] || 0) + 1));
  const tagsOrd = Object.entries(contTags).sort((a, b) => b[1] - a[1]);
  const acoes = S.pdi.filter(x => x.pro === p.id).sort((a, b) => b.id - a.id);
  const pd = S.pdiDraft || { tipo: PDI_TIPOS[0], texto: "" };
  const tendencia = D.rec.length && D.ant.length ? (D.m30 < D.mAnt - 0.3 ? `<span class="trend down">↓ caiu de ${nota1(D.mAnt)} para ${nota1(D.m30)}</span>` : D.m30 > D.mAnt + 0.3 ? `<span class="trend up">↑ subiu de ${nota1(D.mAnt)} para ${nota1(D.m30)}</span>` : `<span class="trend">estável</span>`) : "";
  return `<section class="view">
    ${navBack('data-proviewfechar="1"', esc(p.nome))}
    <div class="card" style="display:flex;align-items:center;gap:14px">${ava(p.foto, p.nome, "lg", "ring")}<div style="min-width:0;flex:1"><h2>${esc(p.nome)}</h2><p class="meta">${esc(p.faz || p.cats.join(", "))} · ${p.ini.slice(0, 2)}h–${p.fim.slice(0, 2)}h</p></div><button class="btn ghost" type="button" data-proedit="${p.id}">Editar</button></div>
    ${D.alerta ? `<div class="alerta" style="cursor:default"><i>!</i><span><b>Precisa de atenção</b>${D.neg} ${D.neg === 1 ? "avaliação ruim" : "avaliações ruins"} nos últimos 30 dias. Converse com ${esc(p.nome)} e registre uma ação de acompanhamento abaixo.</span></div>` : ""}
    <div class="card sec"><span class="eyebrow">Avaliações das clientes</span>${painelNotas(D.l)}
      ${D.l.length ? `<div class="gmini"><div><span>Últimos 30 dias</span><b>${D.rec.length ? "★ " + nota1(D.m30) : "–"}</b></div><div><span>Antes</span><b>${D.ant.length ? "★ " + nota1(D.mAnt) : "–"}</b></div><div><span>Ruins (30d)</span><b style="color:${D.neg ? "var(--bad)" : "inherit"}">${D.neg}</b></div></div>${tendencia}` : ""}
    </div>
    ${tagsOrd.length ? `<div class="card sec"><span class="eyebrow">O que as clientes mais dizem</span><div class="rtags big">${tagsOrd.map(([x, c]) => `<span class="${TAGS_RUINS.includes(x) ? "ruim" : "bom"}">${esc(x)} · ${c}</span>`).join("")}</div></div>` : ""}
    <div class="card sec"><div class="row"><span class="eyebrow">Comentários</span><div class="segm mini" role="group"><button type="button" data-avf="todas" aria-pressed="${filtro === "todas"}">Todas</button><button type="button" data-avf="neg" aria-pressed="${filtro === "neg"}">Negativas</button><button type="button" data-avf="pos" aria-pressed="${filtro === "pos"}">Positivas</button></div></div>
      <div class="revs">${lista.length ? lista.map(a => cardAvaliacao(a, { dona: !DADOS.servidor })).join("") : `<p class="meta">Nenhuma avaliação neste filtro.</p>`}</div>
      <p class="meta">Esconder do app tira só o texto da vista das clientes. A nota continua contando, para a avaliação ser justa.</p></div>
    <div class="card sec"><span class="eyebrow">Acompanhamento (PDI)</span>
      ${acoes.length ? acoes.map(x => `<div class="pdi"><b>${esc(x.tipo)}</b><small>${dayLabel(x.dia)}</small>${x.texto ? `<p>${esc(x.texto)}</p>` : ""}</div>`).join("") : `<p class="meta">Nenhuma ação registrada ainda.</p>`}
      ${DADOS.servidor ? `<p class="meta">O registro de PDI entra quando o servidor tiver essa parte (docs/ENTREGA-VPS.md).</p>` : `<div class="sec" style="border-top:1px solid var(--line-2);padding-top:12px"><span class="meta" style="font-weight:600">Registrar ação</span>
        <div class="chips" style="flex-wrap:wrap;margin:0;padding:0" role="group">${PDI_TIPOS.map(x => `<button class="chip" type="button" data-pditipo="${x}" aria-pressed="${pd.tipo === x}">${x}</button>`).join("")}</div>
        <textarea id="pdi-texto" placeholder="Ex.: conversamos sobre pontualidade; combinamos chegar 15 min antes e revisar em 30 dias.">${esc(pd.texto)}</textarea>
        <button class="btn full" type="button" id="pdi-salvar">Registrar ação</button></div>`}
    </div>
  </section>`;
}
function vProEdit() {
  const d = S.draft, novo = d.id === "novo";
  const ativos = novo ? 0 : S.bookings.filter(b => b.pro === d.id && (b.status === "aguardando" || b.status === "aprovado")).length;
  return `<section class="view">
    ${navBack('data-profechar="1"', novo ? "Nova profissional" : "Editar " + esc(d.nome))}
    <div class="card" style="display:flex;flex-direction:column;align-items:center;gap:10px">${ava(d.foto, d.nome || "+", "xl", "ring")}<button class="btn ghost" type="button" id="pro-foto">${d.foto ? "Trocar foto" : "Adicionar foto"}</button></div>
    <div class="card sec">
      <label class="field">Nome<input type="text" id="d-nome" value="${esc(d.nome)}" placeholder="Ex.: Ana Paula"></label>
      <div class="field">Especialidades (o que ela atende)<div class="chips" style="flex-wrap:wrap;margin:0;padding:0" role="group" aria-label="Especialidades">${CATS.map(c => `<button class="chip" type="button" data-dcat="${esc(c)}" aria-pressed="${d.cats.includes(c)}">${esc(c)}</button>`).join("")}</div></div>
      <label class="field">Descrição curta (aparece para a cliente)<input type="text" id="d-faz" value="${esc(d.faz)}" placeholder="Ex.: Manicure, pedicure e unha em gel"></label>
      <div class="row" style="gap:10px"><label class="field" style="flex:1">Começa às<input type="time" id="d-ini" value="${d.ini}" step="1800"></label><label class="field" style="flex:1">Termina às<input type="time" id="d-fim" value="${d.fim}" step="1800"></label></div>
      <div class="field">Cor na agenda<div class="cores" role="group">${CORES.map(c => `<button type="button" data-cor="${c}" aria-pressed="${d.cor === c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join("")}</div></div>
    </div>
    <button class="btn full" type="button" id="pro-salvar">${novo ? "Adicionar à equipe" : "Salvar alterações"}</button>
    ${novo ? "" : (S.confirmDel
      ? `<div class="card sec" style="border-color:var(--bad)">${ativos
          ? `<p style="font-size:13.5px;color:var(--bad)">${esc(d.nome)} tem ${ativos} agendamento${ativos > 1 ? "s" : ""} em aberto ou confirmado${ativos > 1 ? "s" : ""}. Remarque ou reprove antes de excluir.</p><button class="link" type="button" data-delcancel="1">Entendi</button>`
          : `<p style="font-size:13.5px">Excluir ${esc(d.nome)} da equipe? Ela some da agenda e as clientes não podem mais escolher ela.</p><div class="obtns" style="grid-template-columns:1fr 1fr"><button class="btn ghost" type="button" data-delcancel="1">Cancelar</button><button class="btn bad" type="button" id="pro-excluir">Excluir</button></div>`}</div>`
      : `<button class="btn bad full" type="button" data-delask="1">Excluir profissional</button>`)}
  </section>`;
}

function lightbox() {
  if (!S.zoom) return "";
  const b = bk(S.zoom.id), w = Math.round(S.zoom.k * 100);
  return `<div class="lightbox" role="dialog" aria-label="Comprovante do Pix"><div class="lb-bar"><button type="button" data-zclose="1">✕ Fechar</button><span style="font-size:13px">${w}%</span><div style="display:flex;gap:6px"><button type="button" data-z="-1" aria-label="Diminuir">−</button><button type="button" data-z="1" aria-label="Aumentar">+</button></div></div>
    <div class="lb-view"><img src="${receipt(b)}" alt="Comprovante do Pix de ${esc(b.nome)}" style="width:${w}%"></div></div>`;
}function lerSvc() {
  const g = id => document.getElementById(id);
  if (!S.sdraft || !g("e-nome")) return;
  Object.assign(S.sdraft, { nome: g("e-nome").value, desc: g("e-desc").value, preco: g("e-preco").value, min: +g("e-min").value, cat: g("e-cat").value, disp: g("e-disp").value });
}
function aprovar(b) {
  b.status = "aprovado"; b.hist.push([hhmm(), "Dona", "Aprovou o agendamento"]);
  S.lanc.push({ id: ++seq, bid: b.id, forma: b.pay === "pix" ? "pix" : b.payIn, valor: sum(b.itens), nome: b.nome, itens: b.itens, at: hhmm(), day: HOJE });
  toast("Aprovado. Lançado no Financeiro e a cliente já vê confirmado.");
}let detailFrom = null;

/* ===== registro no motor ===== */
APP.telas.salao = () => {
  if (DADOS.servidor && !DADOS.logado()) return { html: vEntrar() };
  if (S.detail && !bk(S.detail)) S.detail = null;
  if (S.detail) return { html: vDetalhe() };
  if (S.draft) return { html: vProEdit() };
  if (S.proView) return { html: vProPerfil() };
  if (S.sdraft) return { html: vSvcEdit() };
  if (S.cats) return { html: vCats() };
  const html = { pedidos: vPedidos, agenda: vAgenda, financeiro: vFinanceiro, servicos: vServicos, equipe: vEquipe }[S.tab]();
  const nav = tabs([["pedidos", "Pedidos", "inbox", pending()], ["agenda", "Agenda", "cal"], ["financeiro", "Financeiro", "wallet"], ["servicos", "Serviços", "list"], ["equipe", "Equipe", "users"]], S.tab);
  return { html, bottom: (S.tab === "financeiro" ? fFinanceiro() : "") + nav, tall: S.tab === "financeiro" };
};
APP.abas.salao = aba => { S.tab = aba; S.detail = null; S.draft = null; S.proView = null; S.sdraft = null; S.cats = false; S.sheet = null; render(); window.scrollTo(0, 0); };
APP.fotoDestino.salao = url => { if (S.sdraft) S.sdraft.foto = url; else if (S.draft) S.draft.foto = url; };
APP.camadas.push(lightbox);
APP.folhas.rej = sh => {
    const b = bk(sh.id);
    return `<h2>Reprovar pedido</h2><p class="meta">${esc(b.nome)} · ${esc(nomes(b.itens))}. A cliente vê o motivo.${b.pay === "pix" && b.paid ? " O Pix de " + fmt(sum(b.itens)) + " volta automático para ela." : ""}</p>
      ${["Horário indisponível", "Profissional ausente", "Salão fechado nesse dia"].map(r => `<button class="opt" type="button" data-motivo="${r}"><span>${r}</span><b style="color:var(--bad)">→</b></button>`).join("")}`;
};
APP.folhas.caixa = sh => {
    const dia = S.lanc.filter(l => l.day === S.finDay), tot = dia.reduce((a, l) => a + l.valor, 0);
    return `<h2>Fechar caixa</h2><p class="meta">${dayShort(S.finDay)} · ${dia.length} lançamentos. Depois de fechar, os lançamentos do dia ficam travados.</p>
      <div class="card flat sec">${Object.keys(FORMAS).map(f => `<div class="kv"><span>${FORMAS[f][0]}</span><span>${fmt(dia.filter(l => l.forma === f).reduce((a, l) => a + l.valor, 0))}</span></div>`).join("")}<div class="kv total"><span>Total</span><span>${fmt(tot)}</span></div></div>
      <button class="btn-gold" type="button" id="caixa-ok">${IC.lock}Confirmar fechamento</button>`;
};
APP.cliques.push((t, d, e) => {
  if (d.concluir) {
    const b = bk(+d.concluir); if (!podeConcluir(b)) return true;
    b.status = "concluido"; b.concluidoPor = "Dona"; b.hist.push([hhmm(), "Dona", "Concluiu o atendimento"]);
    toast("Atendimento concluído. A cliente vai receber o convite para avaliar."); render(); return true;
  }
  if (t.id === "lg-entrar") { entrarPainel(); return true; }
  if (t.id === "sair-painel") { fazer(() => DADOS.sairSalao(), () => { S.tab = "pedidos"; toast("Você saiu do painel."); }); return true; }
  if (d.proview) { S.proView = d.proview; S.avFiltro = "todas"; S.pdiDraft = null; render(); window.scrollTo(0, 0); return true; }
  if (d.proviewfechar) { S.proView = null; render(); window.scrollTo(0, 0); return true; }
  if (d.avf) { S.avFiltro = d.avf; render(); return true; }
  if (d.ocultar) { const a = S.avaliacoes.find(x => x.id === +d.ocultar); a.oculto = !a.oculto; toast(a.oculto ? "Comentário escondido do app. A nota continua contando." : "Comentário visível no app de novo."); render(); return true; }
  if (d.pditipo) { S.pdiDraft = { ...(S.pdiDraft || { texto: "" }), tipo: d.pditipo }; render(); return true; }
  if (t.id === "pdi-salvar") {
    const pd = S.pdiDraft || { tipo: PDI_TIPOS[0], texto: "" };
    S.pdi.push({ id: ++seq, pro: S.proView, dia: HOJE, tipo: pd.tipo, texto: (pd.texto || "").trim() });
    S.pdiDraft = null; toast("Ação registrada no acompanhamento de " + pro(S.proView).nome + "."); render(); return true;
  }
  /* salão: pedidos */
  if (d.open) { detailFrom = window.scrollY; S.detail = +d.open; render(); window.scrollTo(0, 0); return true; }
  if (d.fechar) { S.detail = null; render(); window.scrollTo(0, detailFrom || 0); return true; }
  if (d.apr) {
    if (DADOS.servidor) { fazer(() => DADOS.salao("POST", "/admin/agendamentos/" + (+d.apr) + "/aprovar"), () => toast("Aprovado. Lançado no Financeiro e a cliente já vê confirmado.")); return true; }
    aprovar(bk(+d.apr)); render(); return true;
  }
  if (d.rej) { S.sheet = { t: "rej", id: +d.rej }; render(); return true; }
  if (d.motivo && DADOS.servidor) {
    const b = bk(S.sheet.id), pago = b.pay === "pix" && b.paid; S.sheet = null;
    fazer(() => DADOS.salao("POST", "/admin/agendamentos/" + b.id + "/reprovar", { motivo: d.motivo }), () => {
      const nb = bk(b.id);
      toast(!pago ? "Reprovado. A cliente foi avisada." : (nb && nb.refund ? "Reprovado. Pix devolvido à cliente." : "Reprovado, mas o Pix não voltou sozinho: devolva pelo app do Mercado Pago."));
    });
    return true;
  }
  if (d.motivo) {
    const b = bk(S.sheet.id); b.status = "reprovado"; b.motivo = d.motivo; b.hist.push([hhmm(), "Dona", "Reprovou: " + d.motivo]);
    if (b.pay === "pix" && b.paid) { b.refund = true; b.hist.push([hhmm(), "Sistema", "Pix devolvido pelo Mercado Pago"]); }
    S.sheet = null; toast(b.refund ? "Reprovado. Pix devolvido à cliente." : "Reprovado. A cliente foi avisada."); render(); return true;
  }
  if (d.zoom) { S.zoom = { id: +d.zoom, k: 1 }; render(); return true; }
  if (d.zclose) { S.zoom = null; render(); return true; }
  if (d.z) { S.zoom.k = Math.min(3, Math.max(0.5, S.zoom.k + 0.5 * +d.z)); render(); return true; }
  /* agenda e financeiro */
  if (d.aday) { S.aDay = d.aday; render(); return true; }
  if (d.apro) { S.aPro = d.apro; render(); return true; }
  if (d.encaixe) { toast("Encaixe: no sistema real a dona marca um horário direto pelo painel a partir de " + d.encaixe + "."); return true; }
  if (d.finf) { S.finF = d.finf; render(); return true; }
  if (t.id === "fechar-caixa") { S.sheet = { t: "caixa" }; render(); return true; }
  if (t.id === "caixa-ok" && DADOS.servidor) { S.sheet = null; fazer(() => DADOS.salao("POST", "/admin/caixa/fechar", { dia: S.finDay }), () => toast("Caixa do dia fechado.")); return true; }
  if (t.id === "caixa-ok") { const dia = S.lanc.filter(l => l.day === S.finDay); S.caixas[S.finDay] = { at: hhmm(), total: dia.reduce((a, l) => a + l.valor, 0) }; S.sheet = null; toast("Caixa do dia fechado."); render(); return true; }
  /* serviços */
  if (d.tog && DADOS.servidor) {
    const s = svc(+d.tog), nd = s.disp === "disponivel" ? "pausado" : "disponivel";
    fazer(() => DADOS.salao("PUT", "/admin/servicos/" + s.id, { disp: nd }), () => toast(s.nome + (nd === "disponivel" ? " disponível para as clientes." : " pausado hoje.")));
    return true;
  }
  if (d.tog) { const s = svc(+d.tog); s.disp = s.disp === "disponivel" ? "pausado" : "disponivel"; toast(s.nome + (s.disp === "disponivel" ? " disponível para as clientes." : " pausado hoje.")); render(); return true; }
  if (d.svcedit) {
    const s = d.svcedit === "novo" ? { id: "novo", nome: "", desc: "", preco: 50, min: 60, cat: CATS[0], disp: "disponivel", foto: "", opcoes: [] } : svc(+d.svcedit);
    S.sdraft = { ...s, opcoes: s.opcoes.map(o => ({ ...o })) }; S.novaOpt = false; render(); window.scrollTo(0, 0); return true;
  }
  if (d.svcfechar) { S.sdraft = null; render(); window.scrollTo(0, 0); return true; }
  if (t.id === "svc-foto") { lerSvc(); document.getElementById("foto-input").click(); return true; }
  if (t.id === "svc-rmfoto") { lerSvc(); S.sdraft.foto = ""; render(); return true; }
  if (t.id === "opt-add") { lerSvc(); S.novaOpt = true; render(); return true; }
  if (d.optcancel) { S.novaOpt = false; render(); return true; }
  if (t.id === "opt-ok") {
    const n = document.getElementById("o-nome").value.trim();
    if (!n) { toast("Coloque o nome da opção."); return true; }
    lerSvc(); S.sdraft.opcoes.push({ nome: n, preco: Math.max(0, +document.getElementById("o-preco").value || 0), min: +document.getElementById("o-min").value });
    S.novaOpt = false; render(); return true;
  }
  if (d.rmopt) { lerSvc(); S.sdraft.opcoes.splice(+d.rmopt, 1); render(); return true; }
  if (t.id === "svc-salvar") {
    lerSvc(); const e2 = S.sdraft;
    if (!e2.nome.trim()) { toast("Coloque o nome do serviço."); return true; }
    const dados = { nome: e2.nome.trim(), desc: e2.desc.trim(), preco: Math.max(0, +e2.preco || 0), min: +e2.min, cat: e2.cat, disp: e2.disp, foto: e2.foto, opcoes: e2.opcoes };
    if (DADOS.servidor) {
      fazer(() => e2.id === "novo" ? DADOS.salao("POST", "/admin/servicos", dados) : DADOS.salao("PUT", "/admin/servicos/" + e2.id, dados),
        () => { toast(e2.id === "novo" ? dados.nome + " publicado." : "Alterações em " + dados.nome + " salvas."); S.sdraft = null; window.scrollTo(0, 0); });
      return true;
    }
    if (e2.id === "novo") { SERVICES.push({ id: ++seq, ...dados }); toast(dados.nome + " publicado."); }
    else { Object.assign(SERVICES.find(s => s.id === e2.id), dados); toast("Alterações em " + dados.nome + " salvas."); }
    S.sdraft = null; render(); window.scrollTo(0, 0); return true;
  }
  if (t.id === "svc-dup") { lerSvc(); S.sdraft = { ...S.sdraft, id: "novo", nome: S.sdraft.nome + " (cópia)", opcoes: S.sdraft.opcoes.map(o => ({ ...o })) }; toast("Cópia criada. Ajuste e publique."); render(); window.scrollTo(0, 0); return true; }
  if (t.id === "svc-arq" && DADOS.servidor) {
    const id = S.sdraft.id, nome = S.sdraft.nome;
    fazer(() => DADOS.salao("PUT", "/admin/servicos/" + id, { disp: "arquivado" }), () => { S.cart = S.cart.filter(k => it(k).sid !== id); S.sdraft = null; toast(nome + " arquivado."); });
    return true;
  }
  if (t.id === "svc-arq") { const s = SERVICES.find(x => x.id === S.sdraft.id); s.disp = "arquivado"; S.cart = S.cart.filter(k => it(k).sid !== s.id); S.sdraft = null; toast(s.nome + " arquivado."); render(); return true; }
  if (t.id === "abrir-cats") { S.cats = true; render(); window.scrollTo(0, 0); return true; }
  if (d.catsfechar) { S.cats = false; render(); return true; }
  if (t.id === "cat-add") {
    const n = document.getElementById("cat-nova").value.trim();
    if (!n) { toast("Escreva o nome da categoria."); return true; }
    if (CATS.some(c => c.toLowerCase() === n.toLowerCase())) { toast("Essa categoria já existe."); return true; }
    if (DADOS.servidor) { fazer(() => DADOS.salao("POST", "/admin/categorias", { nome: n }), () => toast("Categoria " + n + " criada.")); return true; }
    CATS.push(n); toast("Categoria " + n + " criada."); render(); return true;
  }
  if (d.rmcat) {
    const c = CATS[+d.rmcat];
    if (SERVICES.some(s => s.cat === c && s.disp !== "arquivado")) { toast("Mova ou arquive os serviços de " + c + " antes de excluir."); return true; }
    if (CATS.length === 1) { toast("Precisa ter pelo menos uma categoria."); return true; }
    if (DADOS.servidor) { fazer(() => DADOS.salao("POST", "/admin/categorias/excluir", { nome: c }), () => toast("Categoria " + c + " excluída.")); return true; }
    CATS.splice(+d.rmcat, 1); PROS.forEach(p => p.cats = p.cats.filter(x => x !== c)); toast("Categoria " + c + " excluída."); render(); return true;
  }
  /* equipe */
  if (d.proedit) {
    const p = d.proedit === "novo" ? { id: "novo", nome: "", foto: "", cats: [], faz: "", ini: "09:00", fim: "18:00", cor: CORES[PROS.length % CORES.length] } : pro(d.proedit);
    S.draft = { ...p, cats: [...p.cats] }; S.confirmDel = false; render(); window.scrollTo(0, 0); return true;
  }
  if (d.profechar) { S.draft = null; render(); window.scrollTo(0, 0); return true; }
  if (d.dcat) { const c = S.draft.cats; S.draft.cats = c.includes(d.dcat) ? c.filter(x => x !== d.dcat) : [...c, d.dcat]; render(); return true; }
  if (d.cor) { S.draft.cor = d.cor; render(); return true; }
  if (t.id === "pro-foto") { document.getElementById("foto-input").click(); return true; }
  if (t.id === "pro-salvar") {
    const dr = S.draft;
    if (!dr.nome.trim()) { toast("Coloque o nome da profissional."); return true; }
    if (!dr.cats.length) { toast("Escolha pelo menos uma especialidade."); return true; }
    if (toMin(dr.fim) - toMin(dr.ini) < 60) { toast("O expediente precisa ter pelo menos 1 hora."); return true; }
    const dados = { nome: dr.nome.trim(), foto: dr.foto, cats: dr.cats, faz: dr.faz.trim() || dr.cats.join(", "), ini: dr.ini, fim: dr.fim, cor: dr.cor };
    if (DADOS.servidor) {
      fazer(() => dr.id === "novo" ? DADOS.salao("POST", "/admin/profissionais", dados) : DADOS.salao("PUT", "/admin/profissionais/" + dr.id, dados),
        () => { toast(dr.id === "novo" ? dados.nome + " entrou na equipe." : "Dados de " + dados.nome + " salvos."); S.draft = null; window.scrollTo(0, 0); });
      return true;
    }
    if (dr.id === "novo") { PROS.push({ id: "p" + (++seq), ...dados }); toast(dados.nome + " entrou na equipe."); }
    else { Object.assign(PROS.find(p => p.id === dr.id), dados); toast("Dados de " + dados.nome + " salvos."); }
    S.draft = null; render(); window.scrollTo(0, 0); return true;
  }
  if (d.delask) { S.confirmDel = true; render(); return true; }
  if (d.delcancel) { S.confirmDel = false; render(); return true; }
  if (t.id === "pro-excluir" && DADOS.servidor) {
    const id = S.draft.id, n = S.draft.nome;
    fazer(() => DADOS.salao("DELETE", "/admin/profissionais/" + id), () => { S.draft = null; S.proView = null; S.confirmDel = false; toast(n + " saiu da equipe."); window.scrollTo(0, 0); });
    return true;
  }
  if (t.id === "pro-excluir") { const i = PROS.findIndex(p => p.id === S.draft.id), n = PROS[i].nome; PROS.splice(i, 1); S.draft = null; S.proView = null; S.confirmDel = false; toast(n + " saiu da equipe."); render(); window.scrollTo(0, 0); return true; }
});
APP.mudancas.push(e => {
  if (e.target.id === "fin-dia") { S.finDay = e.target.value; render(); return true; }
  if (e.target.id === "e-cat" || e.target.id === "e-disp") { lerSvc(); render(); return true; }
  if (e.target.dataset.catidx) {
    const i = +e.target.dataset.catidx, velho = CATS[i], novo = e.target.value.trim();
    if (!novo || novo === velho) { e.target.value = velho; return true; }
    if (CATS.includes(novo)) { toast("Essa categoria já existe."); e.target.value = velho; return true; }
    if (DADOS.servidor) { fazer(() => DADOS.salao("PUT", "/admin/categorias", { de: velho, para: novo }), () => { if (S.cat === velho) S.cat = novo; toast("Categoria renomeada para " + novo + "."); }); return true; }
    CATS[i] = novo; SERVICES.forEach(s => { if (s.cat === velho) s.cat = novo; }); PROS.forEach(p => p.cats = p.cats.map(x => x === velho ? novo : x));
    if (S.cat === velho) S.cat = novo;
    toast("Categoria renomeada para " + novo + "."); render(); return true;
  }
});
APP.entradas.push(e => {
  if (e.target.id === "pdi-texto") S.pdiDraft = { ...(S.pdiDraft || { tipo: PDI_TIPOS[0] }), texto: e.target.value };
  const dk = { "d-nome": "nome", "d-faz": "faz", "d-ini": "ini", "d-fim": "fim" }[e.target.id];
  if (dk && S.draft) S.draft[dk] = e.target.value;
});
