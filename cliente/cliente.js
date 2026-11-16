/* Sistema de agendamento para salões. A marca vem de marca.js. Ver README.md e CLAUDE.md. */
"use strict";
/* APP DA CLIENTE: catálogo e sacola, agendar (profissional, dia, horário), confirmar e pagar (Pix ou no salão),
   tela do Pix, meus horários e perfil. Usa comum/nucleo.js e comum/dados.js. */
/* ===== APP DA CLIENTE ===== */

/* Falar com o salão no WhatsApp, com mensagem pronta (o número vem de marca.js) */
const FONE_SALAO = String(SALAO.fone || "").replace(/\D/g, "");   /* sem número em marca.js, os botões de WhatsApp não aparecem */
const waSalao = msg => "https://wa.me/55" + FONE_SALAO + (msg ? "?text=" + encodeURIComponent(msg) : "");
const IC_WA = sv('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>');
const btnWa = (msg, texto = "Chamar no WhatsApp", extra = "") => !FONE_SALAO ? "" : `<a class="btn wa-btn ${extra}" href="${waSalao(msg)}" target="_blank" rel="noopener">${IC_WA}${texto}</a>`;
const msgOla = assunto => "Olá! Vim pelo app " + MARCA.nome + " e " + assunto;
function cardWhats(titulo, texto, msg) {
  if (!FONE_SALAO) return "";
  return `<div class="card wa-card"><span class="wa-ic">${IC_WA}</span><div style="min-width:0"><h3>${titulo}</h3><p class="meta">${texto}</p></div>${btnWa(msg, "Chamar no WhatsApp", "full")}</div>`;
}
function vCatalogo() {
  if (!CATS.includes(S.cat)) S.cat = CATS[0];
  const list = SERVICES.filter(s => (s.disp === "disponivel" || s.disp === "pausado") && s.cat === S.cat).sort((a, b) => a.disp.localeCompare(b.disp));
  const P = S.perfil, nome = P.nome ? P.nome.split(" ")[0] : "";
  return `<section class="view">
    <div class="top"><img src="${LOGO}" alt="${esc(MARCA.nomeCompleto)}"><button class="ava me ring" type="button" data-tab="perfil" aria-label="Meu perfil">${P.foto ? `<img src="${P.foto}" alt="">` : esc(ini(P.nome || "?"))}</button></div>
    <div class="pad-x" style="margin-top:6px"><p class="muted" style="font-size:14px">${nome ? "Olá, " + esc(nome) : "Olá! Seja bem-vinda"}</p><h1 style="margin-top:2px">O que vamos fazer hoje?</h1></div>
    <div class="chips" role="group" aria-label="Categorias">${CATS.map(c => `<button class="chip" type="button" data-cat="${esc(c)}" aria-pressed="${c === S.cat}">${esc(c)}</button>`).join("")}</div>
    <div class="row pad-x" style="margin-top:4px"><span class="eyebrow">${esc(S.cat)}</span><span class="meta">${list.length} ${list.length === 1 ? "serviço" : "serviços"}</span></div>
    ${list.length ? list.map(s => {
      const k = S.cart.find(x => it(x).sid === s.id), on = !!k, off = s.disp === "pausado", I = on ? it(k) : null;
      return `<button class="card scard ${on ? "on" : ""}" type="button" data-svc="${s.id}" aria-pressed="${on}" ${off ? "disabled" : ""}>
        <div style="min-width:0"><h3>${esc(s.nome)}${on && I.op ? `<span class="optag">${esc(I.op)}</span>` : ""}${off ? `<span class="tag-off">Indisponível hoje</span>` : ""}</h3><p>${esc(s.desc)}</p>
          <div class="smeta"><span class="ttag">${on ? dur(I.min) : (s.opcoes.length ? "a partir de " + dur(minDur(s)) : dur(s.min))}</span><b>${on ? fmt(I.preco) : (s.opcoes.length ? "a partir de " + fmt(desde(s)) : fmt(s.preco))}</b></div></div>
        <span class="addc" aria-hidden="true">${on ? "✓" : "+"}</span></button>`;
    }).join("") : `<div class="empty">Nenhum serviço nesta categoria por enquanto.${btnWa(msgOla("queria saber sobre serviços de " + S.cat.toLowerCase() + "."), "Perguntar ao salão")}</div>`}
    ${cardWhats("Não encontrou o que procura?", "Fale direto com o salão: tiramos dúvidas e combinamos serviços que não estão no app.", msgOla("queria saber sobre um serviço que não encontrei."))}
    <p class="meta pad-x">Serviços, preços e profissionais de exemplo <span class="tag-ex">Exemplo</span></p>
  </section>`;
}
function fCatalogo() {
  if (!S.cart.length) return "";
  const n = S.cart.length;
  return `<div class="float"><div class="float-in"><span class="bagic">${IC.bag}<span>${n}</span></span><div><small>${n} ${n > 1 ? "serviços" : "serviço"} · ${dur(mins(S.cart))}</small><b>${fmt(sum(S.cart))}</b></div><button class="btn-w" type="button" id="go-agendar">Escolher horário</button></div></div>`;
}

function vAgendar() {
  const cands = prosFor(S.cart), need = mins(S.cart);
  if (S.pro !== "qualquer" && !cands.find(p => p.id === S.pro)) S.pro = "qualquer";
  const dias = weekDays(S.week), mes = MES[dOf(dias.find(aberto) || dias[3]).getMonth()];
  const sl = slots(S.day).filter(s => S.turno === "manha" ? toMin(s.t) < 720 : toMin(s.t) >= 720);
  return `<section class="view">
    ${navBack('data-go="catalogo"', "Agendar horário")}
    ${stepper(2)}
    <div class="strip">${IC.bag}<span><b>${esc(nomes(S.cart))}</b> · ${dur(need)}</span><button class="link" type="button" data-go="catalogo">Editar</button></div>
    <div class="card sec"><span class="eyebrow">Profissional</span>
      ${cands.length ? `<div class="hs" role="group" aria-label="Profissional">
        <button class="pcard" type="button" data-pro="qualquer" aria-pressed="${S.pro === "qualquer"}"><span class="ck">✓</span><span class="anyico">✦</span><b>Qualquer uma</b><span class="meta">1ª livre</span><div class="skills"><span class="n">Mais rápido</span></div></button>
        ${cands.map(p => `<button class="pcard" type="button" data-pro="${p.id}" aria-pressed="${S.pro === p.id}"><span class="ck">✓</span>${ava(p.foto, p.nome, "lg")}<b>${esc(p.nome)}</b><span class="hr">${p.ini.slice(0, 2)}h–${p.fim.slice(0, 2)}h</span>${resumoNota(p)}<div class="skills">${skills(p).slice(0, 3).map(x => `<span>${esc(x)}</span>`).join("")}</div></button>`).join("")}
      </div>${S.pro !== "qualquer" ? `<button class="link" type="button" data-veraval="${S.pro}">Ver avaliações de ${esc(pro(S.pro).nome)} →</button>` : `<p class="meta">Toque numa profissional para ver as avaliações dela.</p>`}` : `<div class="empty">Nenhuma profissional faz todos esses serviços juntos. Separe em dois agendamentos ou combine com o salão.${btnWa(msgOla("queria agendar " + nomes(S.cart) + " juntos."), "Combinar no WhatsApp")}</div>`}
    </div>
    <div class="card sec"><div class="row"><span class="eyebrow">Dia</span><div class="monthnav"><button type="button" data-wk="-1" ${S.week <= 0 ? "disabled" : ""} aria-label="Semana anterior">‹</button>${mes[0].toUpperCase() + mes.slice(1)}<button type="button" data-wk="1" ${S.week >= 3 ? "disabled" : ""} aria-label="Próxima semana">›</button></div></div>
      <div class="week" role="group">${dias.map(k => { const d = dOf(k), ok = aberto(k), tem = ok && cands.length && slots(k).some(s => s.free);
        return `<button class="wd" type="button" data-day="${k}" ${ok ? "" : "disabled"} aria-pressed="${k === S.day}">${WD[d.getDay()]}<b>${d.getDate()}</b><i class="${tem ? "on" : ""}"></i></button>`; }).join("")}</div>
    </div>
    <div class="card sec"><div class="row"><span class="eyebrow">Horário</span><div class="segm mini" role="group"><button type="button" data-turno="manha" aria-pressed="${S.turno === "manha"}">Manhã</button><button type="button" data-turno="tarde" aria-pressed="${S.turno === "tarde"}">Tarde</button></div></div>
      ${cands.length ? (sl.some(s => s.free) ? `<div class="times" role="group">${sl.map(s => `<button class="time" type="button" data-time="${s.t}" ${s.free ? "" : "disabled"} aria-pressed="${S.time === s.t}">${s.t}</button>`).join("")}</div>` : `<div class="empty" style="padding:18px">Sem horário livre ${S.turno === "manha" ? "de manhã" : "à tarde"} nesse dia. Tente o outro turno ou outro dia, ou peça um encaixe ao salão.${btnWa(msgOla("queria um encaixe para " + nomes(S.cart) + " em " + dayLabel(S.day) + "."), "Pedir encaixe")}</div>`) : ""}
    </div>
  </section>`;
}
function quemNoHorario() {
  if (S.pro !== "qualquer") return S.pro;
  return (slotsAny(S.day, mins(S.cart)).find(s => s.t === S.time) || {}).pro || (prosFor(S.cart)[0] || {}).id;
}
function bAgendar() {
  const q = S.time ? pro(quemNoHorario()).nome : "";
  return `<div class="bar"><div class="bar-in"><div><small>${S.time ? dayLabel(S.day) + " · " + S.time + " · " + esc(q) : "Escolha dia e horário"}</small><b>${fmt(sum(S.cart))}</b></div>
  <button class="btn" type="button" id="go-pagar" ${S.time ? "" : "disabled"}>Continuar →</button></div></div>`;
}

function vPagar() {
  const P = S.perfil, ok = P.nome && P.fone, d = dOf(S.day), q = pro(quemNoHorario());
  return `<section class="view">
    ${navBack('data-go="agendar"', "Confirmar")}
    ${stepper(3)}
    <div class="card rcard"><div class="rhead"><span class="dblock"><small>${WD[d.getDay()]}</small><b>${d.getDate()}</b></span><span class="hh"><b>${S.time} às ${toHM(toMin(S.time) + mins(S.cart))}</b><span>com ${esc(S.pro === "qualquer" ? q.nome + " (1ª livre)" : q.nome)} · ${MES[d.getMonth()]}</span></span></div>
      <div class="rbody">${S.cart.map(k => { const I = it(k); return `<div class="kv"><span>${esc(I.base)}${I.op ? ` <span class="muted">· ${esc(I.op)}</span>` : ""}</span><span>${fmt(I.preco)}</span></div>`; }).join("")}
        <div class="kv total"><span>Total</span><span>${fmt(sum(S.cart))}</span></div></div></div>
    <div class="card sec"><span class="eyebrow" style="display:flex;align-items:center;gap:8px"><span style="width:16px;height:16px;display:inline-grid">${IC.card}</span>Pagamento</span>
      <button class="payopt" type="button" data-pay="pix" aria-pressed="${S.pay === "pix"}"><span class="pixtile"><i></i></span><span><h3>Pix agora</h3><p>Devolvido se não aprovar</p></span><span class="radio"></span></button>
      <button class="payopt" type="button" data-pay="salao" aria-pressed="${S.pay === "salao"}"><span class="minicard"></span><span><h3>No salão</h3><p>Cartão de crédito ou dinheiro</p></span><span class="radio"></span></button>
      ${S.pay === "salao" ? `<div class="payin" role="group" aria-label="Como vai pagar no salão"><button class="chip" type="button" data-payin="cartao" aria-pressed="${S.payIn === "cartao"}">Cartão de crédito</button><button class="chip" type="button" data-payin="dinheiro" aria-pressed="${S.payIn === "dinheiro"}">Dinheiro</button></div>` : ""}
    </div>
    ${ok ? `<div class="card row" style="justify-content:flex-start;padding:12px 16px">${ava(P.foto, P.nome, "sm")}<div style="flex:1;min-width:0"><h3 style="font-size:14px">${esc(P.nome)}</h3><p class="meta">${esc(P.fone)}</p></div><button class="link" type="button" data-tab="perfil">Editar</button></div>`
      : `<div class="card sec"><span class="eyebrow">Seus dados</span>
          <label class="field">Nome completo<input type="text" id="f-nome" autocomplete="name" value="${esc(S.fNome || "")}" placeholder="Como está no seu documento"></label>
          <label class="field">WhatsApp<input type="tel" id="f-fone" autocomplete="tel" value="${esc(S.fFone || "")}" placeholder="(94) 9 0000-0000"></label>
          <p class="meta">Fica salvo no seu perfil para as próximas vezes.</p></div>`}
    <label class="card field obsbox">Observação (opcional)<textarea id="f-obs" placeholder="Ex.: tenho alergia a amônia">${esc(S.obs)}</textarea></label>
  </section>`;
}
function bPagar() {
  return `<div class="bar"><div class="bar-col"><button class="btn full" type="button" id="enviar">${S.pay === "pix" ? "Pagar " + fmt(sum(S.cart)) + " com Pix" : "Enviar pedido"}</button><small>O salão confirma seu horário em seguida</small></div></div>`;
}

function vPix() {
  const b = bk(S.pixFor);
  if (!b) return `<section class="view">${navBack('data-tab="meus"', "Pagamento Pix")}<div class="empty">Pedido não encontrado.</div></section>`;
  /* com servidor: valor, QR e código vêm do Mercado Pago (pelo servidor); na demonstração, um código de exemplo */
  const P = DADOS.servidor && S.pix && S.pix.bid === b.id ? S.pix : null;
  const valor = P ? P.valor : sum(b.itens);
  const code = DADOS.servidor ? (P ? P.copia_e_cola : "") : "00020126580014BR.GOV.BCB.PIX0136salao-exemplo-" + b.id + "5204000053039865406" + sum(b.itens).toFixed(2) + "5802BR5907EXEMPLO6006CIDADE62070503***6304EX" + b.id;
  const qr = P && P.qr_base64 ? `<img src="data:image/png;base64,${P.qr_base64}" alt="QR Code do Pix" style="width:100%;height:100%;image-rendering:pixelated">` : `<canvas id="qr" width="29" height="29" aria-label="QR Code do Pix${DADOS.servidor ? " (teste)" : " (exemplo)"}"></canvas>`;
  const rodape = !DADOS.servidor
    ? `<div class="card sec flat"><p class="meta">Protótipo: no sistema de verdade o Mercado Pago avisa o servidor quando o Pix cai e esta tela muda sozinha. Aqui, simule:</p><button class="btn full" style="background:var(--ok)" type="button" id="simular-pix">Simular Pix pago</button></div>`
    : P && P.teste ? `<div class="card sec flat"><p class="meta"><b>Pix de teste.</b> O salão está em período de testes: nenhum dinheiro é cobrado por este código. Quando o pagamento for confirmado, esta tela muda sozinha.</p></div>`
    : `<div class="card sec flat"><p class="meta">Assim que o Pix cair, esta tela muda sozinha e o seu pedido vai para o salão. Se não aprovarem, o Pix volta para você.</p></div>`;
  return `<section class="view">
    ${navBack('data-tab="meus"', "Pagamento Pix")}
    <div class="card sec" style="align-items:center;text-align:center;gap:14px">
      <span class="pixtile" style="width:52px;height:52px"><i></i></span>
      <div><p class="meta">Pague para enviar seu pedido ao salão</p><p style="font-size:28px;font-weight:700;letter-spacing:-.02em">${fmt(valor)}</p></div>
      <div class="qr">${qr}</div>
      <div class="waiting"><span class="spin"></span>Aguardando o pagamento</div>
    </div>
    <div class="card sec"><span class="eyebrow">Pix copia e cola</span><div class="code" id="pix-code">${esc(code)}</div><button class="btn ghost full" type="button" id="copiar">Copiar código</button></div>
    ${rodape}
  </section>`;
}
/* com servidor: pergunta a cada 4 s se o Pix caiu; quando cai, vai para Meus horários */
let pixTimer = null;
function acompanharPix() {
  clearInterval(pixTimer);
  pixTimer = setInterval(async () => {
    if (S.view !== "pix" || !S.pix) { clearInterval(pixTimer); return; }
    try {
      const st = await DADOS.statusPix();
      if (st === "approved") { clearInterval(pixTimer); toast("Pix confirmado! Pedido enviado ao salão."); go("meus"); }
    } catch (_) { /* sem internet agora: tenta de novo */ }
  }, 4000);
}
function vMeus() {
  const mine = S.bookings.filter(b => b.mine);
  const prox = mine.filter(b => b.day >= HOJE).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  const hist = mine.filter(b => b.day < HOJE);
  const list = S.meusTab === "prox" ? prox : hist;
  const wa = waSalao();
  return `<section class="view">
    <h1 class="pad-x" style="margin-top:12px">Meus horários</h1>
    <div class="segm" role="group"><button type="button" data-meus="prox" aria-pressed="${S.meusTab === "prox"}">Próximos · ${prox.length}</button><button type="button" data-meus="hist" aria-pressed="${S.meusTab === "hist"}">Histórico</button></div>
    ${list.length ? list.map(b => {
      const d = dOf(b.day), p = pro(b.pro), off = b.status === "reprovado";
      return `<article class="card bcard"><div class="row">${statusPill(b)}<span class="meta">${payText(b)}</span></div>
        <div class="bline"><span class="dbox ${off ? "dim" : ""}"><small>${WD[d.getDay()]}</small><b>${d.getDate()}</b><em>${MES[d.getMonth()].slice(0, 3)}</em></span>
          <div style="min-width:0"><h3>${esc(nomes(b.itens))}</h3><p class="meta">${b.time} – ${toHM(toMin(b.time) + mins(b.itens))}</p><div class="who">${ava(p.foto, p.nome, "xs")}com ${esc(p.nome)} · ${fmt(sum(b.itens))}</div></div></div>
        ${b.avaliacao ? `<div class="minhaav">Sua avaliação ${estrelas((S.avaliacoes.find(a => a.id === b.avaliacao) || { nota: 0 }).nota, "sm")}</div>` : ""}
        ${podeAvaliar(b) ? `<button class="btn full avbtn" type="button" data-avaliar="${b.id}"><span class="stars-ic">★</span>Avaliar atendimento com ${esc(p.nome)}</button>` : ""}
        ${b.status === "aprovado" ? `<div class="acts"><a class="btn soft" href="${SALAO.mapa}" target="_blank" rel="noopener">Como chegar</a>${FONE_SALAO ? `<a class="btn soft" href="${wa}" target="_blank" rel="noopener">Falar no WhatsApp</a>` : ""}</div>` : ""}
        ${off ? `<div class="why"><i>!</i><span><b>${esc(b.motivo || "Não aprovado")}.</b> ${b.refund ? "Seu Pix de " + fmt(sum(b.itens)) + " foi devolvido." : "Escolha outro, sem custo."}</span></div>
          <button class="btn-gold" type="button" data-go="agendar" data-refaz="${b.id}"><span style="width:17px;height:17px;display:inline-grid">${IC.cal}</span>Escolher outro horário</button>` : ""}
        ${b.status === "pix" ? `<button class="btn full" type="button" data-pagar="${b.id}">Pagar Pix</button>` : ""}
        ${b.status === "aguardando" ? `<p class="meta">O salão vai conferir a agenda e responder por aqui.</p>` : ""}
      </article>`;
    }).join("") : `<div class="empty">${S.meusTab === "prox" ? "Você ainda não tem horários marcados." : "Seus atendimentos já feitos aparecem aqui."}<button class="btn" type="button" data-tab="catalogo">Agendar agora</button></div>`}
  </section>`;
}
/* avaliar: só depois que a profissional (ou a dona) marcou o atendimento como concluído; uma vez por atendimento */
const podeAvaliar = b => b.mine && b.status === "concluido" && !b.avaliacao;
/* pop-up ao abrir o app: o último atendimento concluído ainda sem avaliação; "Agora não" não insiste de novo */
const avaliacaoPendente = () => S.bookings.filter(b => podeAvaliar(b) && !b.avAdiada).sort((a, b) => (b.day + b.time).localeCompare(a.day + a.time))[0];
function folhaAvaliar() {
  const a = S.avDraft, b = bk(a.bid), p = pro(b.pro), tags = a.nota && a.nota <= 3 ? TAGS_RUINS : TAGS_BOAS;
  return `${a.popup ? `<div class="row" style="justify-content:flex-start;gap:12px">${ava(p.foto, p.nome, "md")}<span class="eyebrow">Seu último atendimento</span></div>` : ""}<h2>Como foi com ${esc(p.nome)}?</h2><p class="meta">${esc(nomes(b.itens))} · ${dayLabel(b.day)}. Sua avaliação ajuda outras clientes e o salão.</p>
    <div class="starpick" role="group" aria-label="Nota">${[1, 2, 3, 4, 5].map(k => `<button type="button" data-nota="${k}" aria-pressed="${k <= (a.nota || 0)}" aria-label="${k} ${k === 1 ? "estrela" : "estrelas"}">★</button>`).join("")}</div>
    <p class="meta" style="text-align:center;margin-top:-6px">${["Toque nas estrelas", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"][a.nota || 0]}</p>
    ${a.nota ? `<div class="chips" style="flex-wrap:wrap;margin:0;padding:0" role="group" aria-label="O que marcou">${tags.map(x => `<button class="chip" type="button" data-avtag="${x}" aria-pressed="${a.tags.includes(x)}">${x}</button>`).join("")}</div>` : ""}
    <label class="field">Comentário (opcional)<textarea id="av-texto" placeholder="Conte como foi o atendimento">${esc(a.texto || "")}</textarea></label>
    <button class="btn full" type="button" id="av-enviar" ${a.nota ? "" : "disabled"}>Enviar avaliação</button>`;
}

function vPerfil() {
  const P = S.perfil;
  return `<section class="view">
    <h1 class="pad-x" style="margin-top:12px">Meu perfil</h1>
    <div class="card" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:22px">
      ${ava(P.foto, P.nome || "?", "xl", "ring")}
      <button class="btn ghost" type="button" id="trocar-foto">${P.foto ? "Trocar foto" : "Adicionar foto"}</button>
      <p class="meta" style="text-align:center">A foto ajuda o salão a te reconhecer na chegada.</p>
    </div>
    <div class="card sec">
      <label class="field">Nome completo<input type="text" id="p-nome" autocomplete="name" value="${esc(P.nome)}"></label>
      <label class="field">WhatsApp<input type="tel" id="p-fone" autocomplete="tel" value="${esc(P.fone)}" placeholder="(94) 9 0000-0000"></label>
      <label class="field">Endereço<input type="text" id="p-end" autocomplete="street-address" value="${esc(P.end)}" placeholder="Rua, número e bairro"></label>
    </div>
    <button class="btn full" type="button" id="salvar-perfil">Salvar perfil</button>
    ${cardWhats("Falar com o salão", "Dúvidas, remarcação ou um pedido especial? Chame a gente no WhatsApp.", msgOla("tenho uma dúvida."))}
  </section>`;
}
function drawQR() {
  const c = document.getElementById("qr"); if (!c) return;
  const x = c.getContext("2d"), n = 29; let h = 2166136261 ^ S.pixFor;
  const tinta = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#211B18";
  x.fillStyle = "#fff"; x.fillRect(0, 0, n, n); x.fillStyle = tinta;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { h = Math.imul(h ^ (i * 31 + j), 16777619); if ((h >>> 7) & 1) x.fillRect(i, j, 1, 1); }
  [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([a, b]) => { x.fillStyle = tinta; x.fillRect(a, b, 7, 7); x.fillStyle = "#fff"; x.fillRect(a + 1, b + 1, 5, 5); x.fillStyle = tinta; x.fillRect(a + 2, b + 2, 3, 3); });
}
function readPerfilFields() {
  const el = document.getElementById("p-nome");
  if (el) { S.perfil.nome = el.value.trim(); S.perfil.fone = document.getElementById("p-fone").value.trim(); S.perfil.end = document.getElementById("p-end").value.trim(); }
}function fimSemana() { const k = weekDays(S.week).find(x => aberto(x)); if (k && !weekDays(S.week).includes(S.day)) { S.day = k; S.time = null; } }

/* ===== registro no motor ===== */
APP.telas.cliente = () => {
  const v = S.view;
  const pend = !S.sheet && ["catalogo", "meus", "perfil"].includes(v) ? avaliacaoPendente() : null;
  if (pend) { S.avDraft = { bid: pend.id, nota: 0, tags: [], texto: "", popup: true }; S.sheet = { t: "avaliar" }; }
  const html = { catalogo: vCatalogo, agendar: vAgendar, pagar: vPagar, pix: vPix, meus: vMeus, perfil: vPerfil }[v]();
  const nav = tabs([["catalogo", "Serviços", "bag"], ["meus", "Horários", "cal"], ["perfil", "Perfil", "user"]], ["meus", "perfil"].includes(v) ? v : "catalogo");
  if (v === "agendar") return { html, bottom: bAgendar() };
  if (v === "pagar") return { html, bottom: bPagar() };
  if (v === "pix") return { html, bottom: nav, depois: drawQR };
  return { html, bottom: (v === "catalogo" ? fCatalogo() : "") + nav, tall: v === "catalogo" && S.cart.length > 0 };
};
APP.abas.cliente = aba => { readPerfilFields(); go(aba); };
APP.fotoDestino.cliente = url => { S.perfil.foto = url; };
APP.guardarCampos.push(readPerfilFields);
APP.folhas.aval = sh => { const p = pro(sh.pro), l = avalDe(p.id);
  return `<div class="row" style="justify-content:flex-start;gap:12px">${ava(p.foto, p.nome, "md")}<div><h2>${esc(p.nome)}</h2><p class="meta">${esc(p.faz || "")}</p></div></div>${painelNotas(l)}
    <div class="revs">${l.slice().sort((a, b) => b.dia.localeCompare(a.dia)).map(a => cardAvaliacao(a)).join("")}</div>`; };
APP.folhas.avaliar = () => ({ html: folhaAvaliar(), fechar: S.avDraft && S.avDraft.popup ? "Agora não" : "Cancelar" });
APP.aoFechar.avaliar = () => { if (S.avDraft && S.avDraft.popup) bk(S.avDraft.bid).avAdiada = true; S.avDraft = null; };
APP.folhas.opt = sh => {
    const s = svc(sh.sid);
    return `<h2>${esc(s.nome)}</h2><p class="meta">Escolha uma opção. O preço e o tempo mudam conforme a escolha.</p>
      ${s.opcoes.map((o, i) => `<button class="opt" type="button" data-addopt="${s.id}:${i}"><span>${esc(o.nome[0].toUpperCase() + o.nome.slice(1))}<small>${dur(o.min)}</small></span><b>${fmt(o.preco)}</b></button>`).join("")}`;
};
APP.cliques.push((t, d, e) => {
  if (d.veraval) { S.sheet = { t: "aval", pro: d.veraval }; render(); return true; }
  if (d.avaliar) { S.avDraft = { bid: +d.avaliar, nota: 0, tags: [], texto: "" }; S.sheet = { t: "avaliar" }; render(); return true; }
  if (d.nota) { const n = +d.nota; if ((n <= 3) !== ((S.avDraft.nota || 5) <= 3)) S.avDraft.tags = []; S.avDraft.nota = n; render(); return true; }
  if (d.avtag) { const g = S.avDraft.tags; S.avDraft.tags = g.includes(d.avtag) ? g.filter(x => x !== d.avtag) : [...g, d.avtag]; render(); return true; }
  if (t.id === "av-enviar") {
    const a = S.avDraft, b = bk(a.bid), P = S.perfil, partes = (P.nome || b.nome).trim().split(/\s+/);
    const nome = partes[0] + (partes.length > 1 ? " " + partes[partes.length - 1][0] + "." : "");
    const nova = { id: ++seq, pro: b.pro, nota: a.nota, texto: (a.texto || "").trim(), tags: a.tags, nome, dia: HOJE, itens: b.itens, bid: b.id, oculto: false };
    S.avaliacoes.push(nova); b.avaliacao = nova.id; S.sheet = null; S.avDraft = null;
    toast("Obrigada! Sua avaliação foi enviada."); render(); return true;
  }
  if (d.cat) { S.cat = d.cat; render(); return true; }
  if (d.svc) {
    const s = svc(+d.svc);
    if (S.cart.some(k => it(k).sid === s.id)) S.cart = S.cart.filter(k => it(k).sid !== s.id);
    else if (s.opcoes.length) S.sheet = { t: "opt", sid: s.id };
    else S.cart = [...S.cart, String(s.id)];
    S.time = null; render(); return true;
  }
  if (d.addopt) { S.cart = [...S.cart, d.addopt]; S.sheet = null; S.time = null; render(); return true; }
  if (t.id === "go-agendar") { go("agendar"); return true; }
  if (d.go) { if (d.refaz) { S.cart = bk(+d.refaz).itens.map(String); S.time = null; } go(d.go); return true; }
  if (d.pro) { S.pro = d.pro; S.time = null; render(); return true; }
  if (d.wk) { S.week = Math.max(0, Math.min(3, S.week + +d.wk)); fimSemana(); render(); return true; }
  if (d.day) { S.day = d.day; S.time = null; render(); return true; }
  if (d.turno) { S.turno = d.turno; S.time = null; render(); return true; }
  if (d.time) { S.time = d.time; render(); return true; }
  if (t.id === "go-pagar") { go("pagar"); return true; }
  if (d.pay) { S.pay = d.pay; render(); return true; }
  if (d.payin) { S.payIn = d.payin; render(); return true; }
  if (t.id === "enviar") {
    const fn = document.getElementById("f-nome");
    if (fn) { S.perfil.nome = fn.value.trim(); S.perfil.fone = document.getElementById("f-fone").value.trim(); }
    S.obs = document.getElementById("f-obs").value.trim();
    if (!S.perfil.nome || S.perfil.fone.replace(/\D/g, "").length < 10) { toast("Preencha seu nome e um WhatsApp com DDD."); return true; }
    const P = S.perfil;
    if (DADOS.servidor) {
      const dados = { itens: [...S.cart], profissional: S.pro, dia: S.day, hora: S.time, pagamento: S.pay, pagarNoSalao: S.payIn, observacao: S.obs };
      let semPix = false;
      fazer(async () => {
        const b = await DADOS.enviarPedido(dados);
        S.cart = []; S.time = null; S.obs = ""; S.meusTab = "prox";
        if (b.pay === "pix") { try { await DADOS.criarPix(b.id); } catch (_) { semPix = true; } }
        return b;
      }, b => {
        if (b.pay !== "pix") { toast("Pedido enviado! Aguarde a aprovação do salão."); go("meus"); }
        else if (semPix) { toast(DADOS.msgErro("falha_pix") + " Use o botão Pagar Pix em Meus horários."); go("meus"); }
        else { go("pix"); acompanharPix(); }
      });
      return true;
    }
    const b = { id: ++seq, nome: P.nome, fone: P.fone, end: P.end, foto: P.foto, itens: [...S.cart], pro: quemNoHorario(), day: S.day, time: S.time, obs: S.obs, pay: S.pay, payIn: S.payIn, paid: false, status: S.pay === "pix" ? "pix" : "aguardando", mine: true, hist: [[hhmm(), "Cliente", "Pedido criado"]] };
    S.bookings.push(b); S.cart = []; S.time = null; S.obs = ""; S.meusTab = "prox";
    if (b.pay === "pix") { S.pixFor = b.id; go("pix"); } else { toast("Pedido enviado! Aguarde a aprovação do salão."); go("meus"); }
    return true;
  }
  if (d.pagar) {
    if (DADOS.servidor) { fazer(() => DADOS.criarPix(+d.pagar), () => { go("pix"); acompanharPix(); }); return true; }
    S.pixFor = +d.pagar; go("pix"); return true;
  }
  if (t.id === "copiar") {
    const el = document.getElementById("pix-code");
    const sel = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Código selecionado. Copie e cole no app do banco."); };
    try { navigator.clipboard.writeText(el.textContent).then(() => toast("Código Pix copiado."), sel); } catch (_) { sel(); }
    return true;
  }
  if (t.id === "simular-pix" && !DADOS.servidor) { const b = bk(S.pixFor); b.paid = true; b.status = "aguardando"; b.hist.push([hhmm(), "Sistema", "Pix confirmado pelo Mercado Pago"]); toast("Pix confirmado! Pedido enviado ao salão."); go("meus"); return true; }
  if (d.meus) { S.meusTab = d.meus; render(); return true; }
  if (t.id === "trocar-foto") { readPerfilFields(); document.getElementById("foto-input").click(); return true; }
  if (t.id === "salvar-perfil") {
    readPerfilFields();
    if (DADOS.servidor) { fazer(() => DADOS.salvarPerfil(), ok => toast(ok ? "Perfil salvo." : "Perfil salvo neste aparelho. Ele vai junto no seu próximo agendamento.")); return true; }
    toast("Perfil salvo."); render(); return true;
  }
});
APP.entradas.push(e => {
  const k = { "p-nome": "nome", "p-fone": "fone", "p-end": "end" }[e.target.id];
  if (k) S.perfil[k] = e.target.value;
  if (e.target.id === "f-nome") S.fNome = e.target.value;
  if (e.target.id === "f-fone") S.fFone = e.target.value;
  if (e.target.id === "f-obs") S.obs = e.target.value;
  if (e.target.id === "av-texto" && S.avDraft) S.avDraft.texto = e.target.value;
});
