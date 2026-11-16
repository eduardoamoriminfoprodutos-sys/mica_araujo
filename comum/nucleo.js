/* Sistema de agendamento para salões. A marca vem de marca.js. Ver README.md e CLAUDE.md. */
"use strict";
/* NÚCLEO: o que o app da cliente e o painel do salão usam em comum:
   utilidades de data e dinheiro, dados de exemplo, estado, regras de horário, ícones, componentes e o "motor" de tela.
   Cada parte (cliente/cliente.js, salao/salao.js) se registra em APP. */
const APP = { telas: {}, abas: {}, cliques: [], mudancas: [], entradas: [], folhas: {}, aoFechar: {}, camadas: [], fotoDestino: {}, guardarCampos: [] };
const LOGO = MARCA.logo;
const SALAO = MARCA.salao;
const MODO = window.FAV_MODO || "demo";   /* "cliente", "salao" ou "demo" (os dois, com o botão Ver como) */
const fmt = v => "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const fmt0 = v => fmt(v).replace(",00", "");
const dur = m => m >= 60 ? (Math.floor(m / 60) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : "")) : m + " min";
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hhmm = (d = new Date()) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dayKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dOf = k => new Date(k + "T12:00");
const dayLabel = k => { const d = dOf(k); return WD[d.getDay()] + ", " + String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
const dayShort = k => { const d = dOf(k); return WD[d.getDay()] + ", " + d.getDate() + " " + MES[d.getMonth()].slice(0, 3); };
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
const toHM = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const HOJE = dayKey(new Date());
const addDays = (k, n) => { const d = dOf(k); d.setDate(d.getDate() + n); return dayKey(d); };

/* ===== dados de exemplo (trocar pelos reais do salão) ===== */
let CATS = ["Cabelo", "Unhas", "Sobrancelha e cílios", "Estética"];
const SERVICES = [
  { id: 1, cat: "Cabelo", nome: "Corte feminino", desc: "Lavagem, corte e finalização", min: 60, preco: 80 },
  { id: 2, cat: "Cabelo", nome: "Escova", desc: "Escova modelada com finalização", min: 45, preco: 50 },
  { id: 3, cat: "Cabelo", nome: "Hidratação", desc: "Máscara de tratamento e escova", min: 60, preco: 70 },
  { id: 4, cat: "Cabelo", nome: "Selagem", desc: "Redução de volume e frizz", min: 150, preco: 220, opcoes: [{ nome: "curto", preco: 180, min: 120 }, { nome: "médio", preco: 220, min: 150 }, { nome: "longo", preco: 280, min: 180 }] },
  { id: 5, cat: "Cabelo", nome: "Coloração", desc: "Tintura da raiz às pontas", min: 120, preco: 180 },
  { id: 13, cat: "Cabelo", nome: "Corte", desc: "Só o corte, sem finalização", min: 30, preco: 45 },
  { id: 6, cat: "Unhas", nome: "Manicure", desc: "Cutícula e esmaltação", min: 45, preco: 30 },
  { id: 7, cat: "Unhas", nome: "Pedicure", desc: "Cutícula, lixa e esmaltação", min: 45, preco: 35 },
  { id: 8, cat: "Unhas", nome: "Unha em gel", desc: "Alongamento com gel", min: 120, preco: 150 },
  { id: 9, cat: "Sobrancelha e cílios", nome: "Design de sobrancelha", desc: "Medição, pinça e acabamento", min: 30, preco: 40 },
  { id: 10, cat: "Sobrancelha e cílios", nome: "Design com henna", desc: "Design e henna para preencher", min: 45, preco: 55 },
  { id: 11, cat: "Estética", nome: "Limpeza de pele", desc: "Extração, máscara e hidratação", min: 60, preco: 110 },
  { id: 12, cat: "Estética", nome: "Maquiagem", desc: "Maquiagem para evento", min: 60, preco: 120 }
].map(s => ({ disp: "disponivel", foto: "", opcoes: [], ...s }));
const CORES = ["#C99A87", "#8FA58C", "#C9A86A", "#A8909F", "#8E9DB0", "#B9876F"];
const PROS = [
  { id: "ana", nome: "Ana", faz: "Corte, coloração e selagem", cats: ["Cabelo"], ini: "09:00", fim: "18:00", cor: "#C99A87" },
  { id: "bia", nome: "Bia", faz: "Manicure, pedicure e gel", cats: ["Unhas"], ini: "08:00", fim: "17:00", cor: "#A8909F" },
  { id: "carla", nome: "Carla", faz: "Sobrancelha e estética", cats: ["Sobrancelha e cílios", "Estética"], ini: "09:00", fim: "18:00", cor: "#C9A86A" },
  { id: "duda", nome: "Duda", faz: "Cabelo e unhas", cats: ["Cabelo", "Unhas"], ini: "10:00", fim: "19:00", cor: "#8FA58C" }
].map(p => ({ foto: "", ...p }));

/* primeiro dia de atendimento: hoje, ou amanhã se o expediente já acabou; domingo fechado */
const D0 = (() => { const d = new Date(); if (d.getHours() >= 18) d.setDate(d.getDate() + 1); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return dayKey(d); })();
const D1 = (() => { let k = addDays(D0, 1); if (dOf(k).getDay() === 0) k = addDays(k, 1); return k; })();
const HORIZONTE = addDays(D0, 27);
const aberto = k => dOf(k).getDay() !== 0 && k >= D0 && k <= HORIZONTE;

/* avaliações de exemplo: [profissional, nota, dias atrás, cliente, etiquetas, comentário, serviços] */
const AV_EXEMPLO = [
  ["ana", 5, 2, "Juliana A.", ["Caprichosa", "Resultado lindo"], "Amei a selagem, cabelo leve e brilhando. Super atenciosa!", ["4:1"]],
  ["ana", 5, 6, "Renata L.", ["Pontual", "Simpática"], "Chegou na hora e explicou tudo antes de começar.", [1]],
  ["ana", 4, 12, "Paula R.", ["Caprichosa"], "Corte ficou ótimo, só demorou um pouco mais que o previsto.", [1, 2]],
  ["ana", 5, 25, "Camila S.", ["Resultado lindo"], "Melhor coloração que já fiz.", [5]],
  ["ana", 5, 40, "Bruna M.", [], "Sempre volto com ela.", [3]],
  ["bia", 5, 3, "Carol M.", ["Caprichosa", "Ambiente limpo"], "Unhas perfeitas e tudo bem higienizado.", [6, 7]],
  ["bia", 4, 9, "Fernanda S.", ["Simpática"], "Muito gente boa, o esmalte durou bem.", [6]],
  ["bia", 5, 33, "Larissa T.", ["Pontual"], "", [8]],
  ["carla", 5, 4, "Juliana A.", ["Caprichosa", "Resultado lindo"], "Sobrancelha ficou perfeita, natural do jeito que pedi.", [9]],
  ["carla", 5, 15, "Ana P.", ["Simpática"], "Limpeza de pele maravilhosa.", [11]],
  ["carla", 5, 45, "Mariana C.", [], "", [10]],
  ["duda", 2, 3, "Patrícia G.", ["Atrasou", "Atendimento apressado"], "Atrasou 30 minutos e fez a escova com pressa.", [2]],
  ["duda", 1, 8, "Sandra V.", ["Pouca atenção", "Resultado abaixo"], "Ficou no celular durante o atendimento e o corte ficou torto.", [1]],
  ["duda", 3, 14, "Kelly R.", ["Demorou demais"], "Resultado bom, mas demorou demais.", [6]],
  ["duda", 2, 20, "Rose N.", ["Atendimento apressado"], "Parecia com pressa de terminar.", [1]],
  ["duda", 5, 70, "Cris A.", ["Simpática"], "Muito querida, adorei.", [2]],
  ["duda", 5, 85, "Lu M.", ["Caprichosa"], "Mão boa demais!", [7]]
].map(([pro, nota, n, nome, tags, texto, itens], i) => ({ id: i + 1, pro, nota, dia: addDays(HOJE, -n), nome, tags, texto, itens, oculto: false, ex: true }));

let seq = 100;
const S = {
  as: MODO === "salao" ? "salao" : "cliente", view: "catalogo", tab: "pedidos", detail: null, zoom: null, sheet: null,
  cat: "Cabelo", cart: [], pro: "qualquer", day: D0, time: null, turno: "manha", week: 0, obs: "",
  pay: "pix", payIn: "cartao", pixFor: null, meusTab: "prox",
  perfil: { nome: "", fone: "", end: "", foto: "" },
  aDay: D0, aPro: "todas", finDay: HOJE, finF: "todos", caixas: {},
  bookings: [
    { id: 1, nome: "Mariana Costa", fone: "(94) 99111-2233", end: "Rua das Flores, 210, Centro", foto: "", itens: ["4:1"], pro: "ana", day: D0, time: "10:00", obs: "Cabelo muito seco e fino nas pontas. Quero tirar o volume sem perder o movimento.", pay: "pix", paid: true, status: "aguardando", ex: true,
      hist: [["09:12", "Cliente", "Pedido criado"], ["09:13", "Sistema", "Pix confirmado pelo Mercado Pago"]] },
    { id: 2, nome: "Juliana Alves", fone: "(94) 99222-3344", end: "Av. Brasil, 88, Jardim Paraíso", foto: "", itens: [9, 10], pro: "carla", day: D1, time: "14:00", obs: "", pay: "salao", payIn: "dinheiro", paid: false, status: "aguardando", ex: true,
      hist: [["10:40", "Cliente", "Pedido criado"]] },
    { id: 3, nome: "Renata Lima", fone: "(94) 99333-4455", end: "Rua Bahia, 122, Novo Horizonte", foto: "", itens: [9], pro: "carla", day: D0, time: "14:00", obs: "", pay: "salao", payIn: "cartao", paid: false, status: "aprovado", ex: true,
      hist: [["08:02", "Cliente", "Pedido criado"], ["08:20", "Dona", "Aprovou o agendamento"]] },
    { id: 4, nome: "Paula Reis", fone: "(94) 99444-5566", end: "", foto: "", itens: [1], pro: "duda", day: D0, time: "15:00", obs: "Só pontas.", pay: "salao", payIn: "dinheiro", paid: false, status: "aprovado", ex: true,
      hist: [["Ontem", "Cliente", "Pedido criado"], ["Ontem", "Dona", "Aprovou o agendamento"]] }
  ],
  lanc: [
    { id: 1, forma: "cartao", valor: 80, nome: "Paula Reis", itens: [1], at: "10:40", day: HOJE, ex: true },
    { id: 2, forma: "dinheiro", valor: 65, nome: "Juliana Alves", itens: [9, 10], at: "11:05", day: HOJE, ex: true },
    { id: 3, forma: "cartao", valor: 45, nome: "Renata Lima", itens: [9], at: "13:20", day: HOJE, ex: true },
    { id: 4, forma: "dinheiro", valor: 25, nome: "Carol Mendes", itens: [6], at: "14:10", day: HOJE, ex: true }
  ],
  avaliacoes: AV_EXEMPLO,
  pdi: []
};

const svc = id => SERVICES.find(s => s.id === id && s.disp !== "arquivado") || SERVICES.find(s => s.id === id);
const pro = id => PROS.find(p => p.id === id) || { id, nome: "Profissional removida", faz: "", cats: [], ini: "00:00", fim: "00:00", foto: "", cor: "#BDB3AA" };
const bk = id => S.bookings.find(b => b.id === id);
/* item da sacola = "id" ou "id:opção" (ex.: "4:2" = Selagem longo) */
function it(k) {
  const [i, o] = String(k).split(":"), s = svc(+i);
  if (!s) return { sid: +i, nome: "Serviço removido", base: "Serviço removido", op: "", preco: 0, min: 0, cat: "" };
  if (o == null || !s.opcoes[+o]) return { sid: s.id, nome: s.nome, base: s.nome, op: "", preco: s.preco, min: s.min, cat: s.cat };
  const v = s.opcoes[+o];
  return { sid: s.id, nome: s.nome + " (" + v.nome + ")", base: s.nome, op: v.nome, preco: v.preco, min: v.min, cat: s.cat };
}
const sum = ks => ks.reduce((a, k) => a + it(k).preco, 0);
const mins = ks => ks.reduce((a, k) => a + it(k).min, 0);
const nomes = ks => ks.map(k => it(k).base).join(" + ");
const prosFor = ks => PROS.filter(p => ks.every(k => p.cats.includes(it(k).cat)));
const desde = s => s.opcoes.length ? Math.min(...s.opcoes.map(o => o.preco)) : s.preco;
const minDur = s => s.opcoes.length ? Math.min(...s.opcoes.map(o => o.min)) : s.min;
const skills = p => SERVICES.filter(s => p.cats.includes(s.cat) && s.disp === "disponivel").map(s => s.nome.split(" ")[0]).filter((v, i, a) => a.indexOf(v) === i);
const naAgenda = b => b.status === "aprovado" || b.status === "concluido";
const pending = () => S.bookings.filter(b => b.status === "aguardando").length;
const ini = n => (n || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const fotoDe = b => (b.mine && S.perfil.foto) || b.foto;
const ava = (foto, nome, size, extra = "") => `<span class="ava ${size} ${extra}">${foto ? `<img src="${foto}" alt="">` : esc(ini(nome))}</span>`;
const payWord = b => b.pay === "pix" ? "pix" : (b.payIn === "dinheiro" ? "dinheiro" : "cartão");

function slotsFor(proId, dk, need) {
  const p = pro(proId), out = [];
  if (!aberto(dk)) return out;
  const busy = S.bookings.filter(b => b.pro === proId && b.day === dk && b.status !== "reprovado" && b.status !== "pix")
    .map(b => [toMin(b.time), toMin(b.time) + (b.dur != null ? b.dur : mins(b.itens))]);   /* b.dur: horário ocupado que vem do servidor, sem dado da cliente */
  const now = new Date(), isToday = dk === HOJE;
  for (let t = toMin(p.ini); t + need <= toMin(p.fim); t += 30) {
    const clash = busy.some(([a, z]) => t < z && t + need > a);
    const past = isToday && t <= now.getHours() * 60 + now.getMinutes();
    out.push({ t: toHM(t), free: !clash && !past, pro: proId });
  }
  return out;
}
function slotsAny(dk, need) {
  const all = {};
  prosFor(S.cart).forEach(p => slotsFor(p.id, dk, need).forEach(s => { if (s.free) all[s.t] = all[s.t] || p.id; else if (!(s.t in all)) all[s.t] = null; }));
  return Object.keys(all).sort().map(t => ({ t, free: !!all[t], pro: all[t] }));
}
const slots = dk => { const need = mins(S.cart); return S.pro === "qualquer" ? slotsAny(dk, need) : slotsFor(S.pro, dk, need); };

/* comprovante do Pix: no sistema real sai dos dados do pagamento no Mercado Pago */
/* ===== ícones (traço 1.8, estilo Lucide) ===== */
const sv = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  bag: sv('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
  cal: sv('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>'),
  inbox: sv('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>'),
  wallet: sv('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
  list: sv('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  lock: sv('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  back: sv('<path d="m15 18-6-6 6-6"/>'),
  card: sv('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
  check: sv('<path d="M20 6 9 17l-5-5"/>')
};
function tabs(items, cur) {
  return `<nav class="tabs"><div class="in" style="--n:${items.length}">${items.map(([k, label, ic, cnt]) => `<button type="button" data-tab="${k}" ${k === cur ? 'aria-current="page"' : ""}>${IC[ic]}${label}${cnt ? `<span class="count">${cnt}</span>` : ""}</button>`).join("")}</div></nav>`;
}
const navBack = (go, title, right = "") => `<div class="nav"><button class="circ" type="button" ${go} aria-label="Voltar">${IC.back}</button><h2>${title}</h2>${right}</div>`;
function stepper(n) {
  const st = (i, label) => `<span class="st ${i < n ? "done" : i === n ? "cur" : ""}"><i>${i < n ? "✓" : i}</i>${label}</span>`;
  return `<div class="steps">${st(1, "Serviços")}<hr class="${n > 1 ? "done" : ""}">${st(2, "Horário")}<hr class="${n > 2 ? "done" : ""}">${st(3, "Confirmar")}</div>`;
}

function weekDays(w) {
  const start = dOf(D0); start.setDate(start.getDate() + 7 * w);   /* 7 dias a partir do primeiro dia disponível */
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return dayKey(d); });
}function statusPill(b) {
  if (b.status === "pix") return `<span class="pill warn dotted">Aguardando Pix</span>`;
  if (b.status === "aguardando") return `<span class="pill warn dotted">Aguardando salão</span>`;
  if (b.status === "aprovado") return `<span class="pill ok dotted">Confirmado</span>`;
  if (b.status === "concluido") return `<span class="pill ok dotted">Concluído</span>`;
  return `<span class="pill bad dotted">Não aprovado</span>`;
}
function payText(b) {
  if (b.pay === "pix") return b.refund ? "Pix devolvido" : (b.paid ? "Pix pago" : "Pix pendente");
  return "No salão · " + (b.payIn === "dinheiro" ? "dinheiro" : "cartão");
}
/* ===== avaliações (estilo Google) ===== */
const TAGS_BOAS = ["Pontual", "Caprichosa", "Simpática", "Ambiente limpo", "Resultado lindo"];
const TAGS_RUINS = ["Atrasou", "Atendimento apressado", "Pouca atenção", "Resultado abaixo", "Demorou demais"];
const avalDe = proId => S.avaliacoes.filter(a => a.pro === proId);
const media = l => l.length ? l.reduce((s, a) => s + a.nota, 0) / l.length : 0;
const nota1 = v => v.toFixed(1).replace(".", ",");
const diasAtras = k => Math.round((dOf(HOJE) - dOf(k)) / 864e5);
const quando = k => { const n = diasAtras(k); return n <= 0 ? "hoje" : n === 1 ? "ontem" : n < 30 ? "há " + n + " dias" : n < 60 ? "há 1 mês" : "há " + Math.round(n / 30) + " meses"; };
const estrelas = (v, cls = "") => `<span class="stars ${cls}" role="img" aria-label="${nota1(v)} de 5 estrelas"><span style="width:${Math.round(v / 5 * 100)}%"></span></span>`;
/* a nota pública conta TODAS as avaliações; esconder do app só tira o texto do comentário */
const resumoNota = p => { const l = avalDe(p.id); return l.length ? `<span class="rate"><b>★</b> ${nota1(media(l))} <i>(${l.length})</i></span>` : `<span class="rate novo">Sem avaliações ainda</span>`; };
function cardAvaliacao(a, opts = {}) {
  const tags = a.tags.length ? `<div class="rtags">${a.tags.map(x => `<span class="${TAGS_RUINS.includes(x) ? "ruim" : "bom"}">${esc(x)}</span>`).join("")}</div>` : "";
  const texto = a.oculto && !opts.dona ? "" : (a.texto ? `<p>${esc(a.texto)}</p>` : "");
  return `<div class="rev"><div class="row"><span class="rev-who">${ava("", a.nome, "sm")}<span><b>${esc(a.nome)}${a.ex ? ` <span class="tag-ex">Ex.</span>` : ""}</b><small>${esc(nomes(a.itens))}</small></span></span><span class="rev-when">${estrelas(a.nota, "sm")}<small>${quando(a.dia)}</small></span></div>
    ${tags}${texto}${opts.dona ? `<div class="row" style="justify-content:flex-start;gap:10px">${a.oculto ? `<span class="pill n">Escondido do app</span>` : ""}<button class="link" type="button" data-ocultar="${a.id}">${a.oculto ? "Mostrar no app" : "Esconder do app"}</button></div>` : ""}</div>`;
}
/* resumo: média grande, estrelas, quantidade e barras de 5 a 1 */
function painelNotas(lista) {
  const n = lista.length, m = media(lista);
  if (!n) return `<div class="empty" style="padding:18px">Ainda não tem avaliações.</div>`;
  return `<div class="notabox"><div class="nb-big"><b>${nota1(m)}</b>${estrelas(m)}<small>${n} ${n === 1 ? "avaliação" : "avaliações"}</small></div>
    <div class="nb-dist">${[5, 4, 3, 2, 1].map(k => { const c = lista.filter(a => a.nota === k).length; return `<div class="dist"><span>${k}</span><span class="dtrack"><i style="width:${Math.round(c / n * 100)}%"></i></span><span>${c}</span></div>`; }).join("")}</div></div>`;
}

/* ===== motor de tela ===== */
function sheet() {
  const sh = S.sheet; if (!sh) return "";
  const f = APP.folhas[sh.t]; if (!f) return "";
  const r = f(sh), html = typeof r === "string" ? r : r.html, fechar = (typeof r === "object" && r.fechar) || "Cancelar";
  return `<div class="scrim" data-sheetclose="1"><div class="sheet" role="dialog" aria-modal="true"><span class="grab"></span>${html}<button class="btn ghost full" type="button" data-sheetclose="1">${fechar}</button></div></div>`;
}
function render() {
  const root = document.getElementById("root"), bottom = document.getElementById("bottom"), app = document.getElementById("app");
  const bc = document.getElementById("as-cliente"), bs = document.getElementById("as-salao");
  if (bc) { bc.setAttribute("aria-pressed", S.as === "cliente"); bs.setAttribute("aria-pressed", S.as === "salao"); bs.innerHTML = "Salão (dona)" + (pending() && S.as === "cliente" ? '<span class="pip"></span>' : ""); }
  const tela = APP.telas[S.as] ? APP.telas[S.as]() : { html: "" };
  root.innerHTML = tela.html; bottom.innerHTML = tela.bottom || "";
  app.classList.toggle("tall", !!tela.tall);
  document.getElementById("layer").innerHTML = sheet() + APP.camadas.map(f => f()).join("");
  if (tela.depois) tela.depois();
  salvar();
}
let tt;
function toast(m) { const t = document.getElementById("toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2600); }
function go(v) { S.view = v; S.sheet = null; render(); window.scrollTo(0, 0); }
const guardarCampos = () => APP.guardarCampos.forEach(f => f());

document.addEventListener("click", e => {
  const t = e.target.closest("button, .scrim");
  if (!t) return;
  const d = t.dataset;
  if (d.sheetclose && (t.tagName === "BUTTON" || e.target === t)) { if (APP.aoFechar[S.sheet.t]) APP.aoFechar[S.sheet.t](S.sheet); S.sheet = null; render(); return; }
  if (t.classList.contains("scrim")) return;
  if (t.id === "as-cliente") { guardarCampos(); S.as = "cliente"; S.zoom = null; S.sheet = null; render(); return; }
  if (t.id === "zerar-demo") { window.zerarDemo(); return; }
  if (t.id === "as-salao") { guardarCampos(); S.as = "salao"; S.sheet = null; render(); window.scrollTo(0, 0); return; }
  if (d.tab) { if (APP.abas[S.as]) APP.abas[S.as](d.tab); return; }
  for (const h of APP.cliques) if (h(t, d, e) === true) return;
});
document.addEventListener("change", e => {
  for (const h of APP.mudancas) if (h(e) === true) return;
  if (e.target.id === "foto-input" && e.target.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"), s = 200, k = Math.min(img.width, img.height); c.width = c.height = s;
        c.getContext("2d").drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, s, s);
        const url = c.toDataURL("image/jpeg", 0.85);
        if (APP.fotoDestino[S.as]) APP.fotoDestino[S.as](url);
        toast("Foto adicionada."); render();
      };
      img.src = r.result;
    };
    r.readAsDataURL(e.target.files[0]); e.target.value = "";
  }
});
document.addEventListener("input", e => { APP.entradas.forEach(h => h(e)); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (S.zoom) S.zoom = null; else if (S.sheet) S.sheet = null; else return; render(); } });
