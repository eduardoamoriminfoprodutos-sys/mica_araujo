/* Sistema de agendamento para salões. A marca vem de marca.js. Ver README.md e CLAUDE.md. */
"use strict";
/* ============================================================
   CAMADA DE DADOS. É O ÚNICO ARQUIVO QUE CONVERSA COM O ARMAZENAMENTO.
   - demo/ (apresentação): grava tudo no localStorage deste navegador, e o evento "storage"
     faz as abas da cliente e do salão conversarem no mesmo aparelho. Aberta no link de apresentação
     do claude.ai (artefato com o banco "db"), também grava num documento compartilhado:
     celular e computador conversam ao vivo.
   - cliente/ e salao/: falam com o servidor do salão (MARCA.api), que guarda tudo no banco.
     O app pergunta a cada 10 s se algo mudou (/rev) e recarrega só quando mudou:
     o pedido novo aparece para a dona e a resposta aparece para a cliente sozinhos.
   As ações (pedir, aprovar, salvar serviço...) chamam DADOS.* e, na resposta, atualizam S e chamam render().
   ============================================================ */
const SERVIDOR = !!(MARCA.api && MODO !== "demo");
const API = SERVIDOR ? MARCA.api.replace(/\/$/, "") : "";
const CHAVE = "agenda-" + MARCA.chave + "-demo-v1";
const CHAVE_LOCAL = "agenda-" + MARCA.chave + "-" + MODO + "-v1";   /* só conveniências deste aparelho: perfil e sacola */
const CHAVE_TOKEN = "agenda-" + MARCA.chave + "-" + MODO + "-acesso";
const guarda = { ler(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, por(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} } };
let ultimoSalvo = "";

/* ---------------- demonstração (sem servidor) ---------------- */
function salvarDemo() {
  try {
    const dados = JSON.stringify({ bookings: S.bookings, lanc: S.lanc, perfil: S.perfil, caixas: S.caixas, avaliacoes: S.avaliacoes, pdi: S.pdi, seq, services: SERVICES, pros: PROS, cats: CATS },
      (k, v) => k === "receipt" ? undefined : v);
    if (dados === ultimoSalvo) return;
    ultimoSalvo = dados; agendarRemoto(dados);
    localStorage.setItem(CHAVE, dados);
  } catch (_) { /* sem armazenamento: a demonstração funciona, só não guarda */ }
}
function aplicarDemo(d) {
  S.bookings = d.bookings; S.lanc = d.lanc; S.perfil = d.perfil; S.caixas = d.caixas || {}; S.avaliacoes = d.avaliacoes || S.avaliacoes; S.pdi = d.pdi || []; seq = d.seq;
  SERVICES.splice(0, SERVICES.length, ...d.services); PROS.splice(0, PROS.length, ...d.pros); CATS = d.cats;
}
function carregarDemo() {
  try {
    const raw = localStorage.getItem(CHAVE); if (!raw) return false;
    aplicarDemo(JSON.parse(raw));
    ultimoSalvo = raw; return true;
  } catch (_) { return false; }
}

/* ---------------- com servidor ---------------- */
const ERROS = {
  rede: "Sem conexão com o salão. Confira a internet e tente de novo.",
  horario_ocupado: "Esse horário acabou de ser ocupado. Escolha outro, por favor.",
  sem_profissional: "Nenhuma profissional faz esses serviços juntos. Separe em dois agendamentos.",
  dia_fechado: "Esse dia não está aberto para agendamento.",
  servico_indisponivel: "Um dos serviços ficou indisponível. Confira a sacola.",
  escolha_a_opcao: "Escolha a opção do serviço antes de continuar.",
  nome_diferente: "Esse WhatsApp já tem cadastro com outro nome. Use o mesmo nome do cadastro.",
  whats_invalido: "Confira o WhatsApp: precisa ter DDD.",
  nome_invalido: "Escreva seu nome completo.",
  muitas_tentativas: "Muitas tentativas seguidas. Espere alguns minutos.",
  usuario_ou_senha: "Usuário ou senha incorretos.",
  falha_pix: "Não consegui gerar o Pix agora. Tente de novo em instantes.",
  ja_pago_ou_fechado: "Esse pedido já foi pago ou respondido.",
  nao_esta_aguardando: "Esse pedido já foi respondido.",
  categoria_existe: "Essa categoria já existe.",
  categoria_com_servicos: "Mova ou arquive os serviços da categoria antes de excluir.",
  ultima_categoria: "Precisa ter pelo menos uma categoria.",
  tem_agendamentos: "Ela tem agendamentos em aberto. Remarque ou reprove antes de excluir.",
  caixa_ja_fechado: "O caixa desse dia já foi fechado.",
  sem_lancamentos: "Não há lançamentos nesse dia.",
  foto_invalida: "Essa foto não pôde ser usada. Tente outra.",
  login_necessario: "Entre de novo para continuar."
};
const msgErro = e => ERROS[e] || "Não deu certo agora. Tente de novo.";
let TOKEN = SERVIDOR ? guarda.ler(CHAVE_TOKEN) : null;
async function api(metodo, caminho, corpo) {
  let r;
  try {
    r = await fetch(API + caminho, { method: metodo, headers: Object.assign({}, corpo ? { "content-type": "application/json" } : {}, TOKEN ? { authorization: "Bearer " + TOKEN } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined });
  } catch (_) { throw { erro: "rede" }; }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && TOKEN && caminho !== "/admin/entrar") { TOKEN = null; guarda.por(CHAVE_TOKEN, null); }
  if (!r.ok) throw { erro: j.error || "falha", status: r.status, extra: j };
  return j;
}
function ocupadosComoAgenda(lista) {   /* horários ocupados de outras clientes, sem nenhum dado delas */
  return (lista || []).map((o, i) => ({ id: -(i + 1), pro: o.pro, day: o.day, time: o.time, dur: o.dur, itens: [], status: "aprovado", anon: true, hist: [] }));
}
function aplicarCatalogo(c) {
  CATS = c.cats; SERVICES.splice(0, SERVICES.length, ...c.services); PROS.splice(0, PROS.length, ...c.pros);
  S.pixTeste = !!c.pixTeste;
}
let MEUS = [], OCUP = [];
function montarCliente() { S.bookings = MEUS.concat(ocupadosComoAgenda(OCUP)); }
function aplicarEstado(e) {   /* painel da dona */
  aplicarCatalogo(e); S.bookings = e.bookings; S.lanc = e.lanc; S.caixas = e.caixas || {};
}
let REV_VISTO = 0, pronto = false;
async function recarregar() {
  if (MODO === "salao") {
    if (!TOKEN) return;
    const e = await api("GET", "/admin/estado"); aplicarEstado(e); REV_VISTO = e.rev;
  } else {
    const c = await api("GET", "/catalogo"); aplicarCatalogo(c); OCUP = c.ocupados; REV_VISTO = c.rev;
    if (TOKEN) { try { MEUS = (await api("GET", "/meus-agendamentos")).bookings; } catch (e) { if (e.status !== 401) throw e; MEUS = []; } }
    montarCliente();
  }
}
const ocupado = () => { const a = document.activeElement; return (a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName)) || !!S.sheet || !!S.zoom || !!S.ocupadoAcao; };
let pendenteRender = false;
async function verificar() {   /* a cada 10 s: só pergunta a versão; baixa tudo só se mudou */
  if (!pronto || document.hidden || (MODO === "salao" && !TOKEN)) return;
  try {
    const r = await api("GET", "/rev");
    if (r.rev !== REV_VISTO || pendenteRender) {
      if (ocupado()) { pendenteRender = true; return; }
      await recarregar(); pendenteRender = false; render();
    }
  } catch (_) { /* sem internet agora: tenta de novo daqui a pouco */ }
}

/* ---------------- ações usadas pelo app da cliente e pelo painel ---------------- */
const DADOS = {
  servidor: SERVIDOR,
  msgErro,
  logado: () => !!TOKEN,
  /* cliente */
  async entrarCliente() {
    const P = S.perfil, fone = P.fone.replace(/\D/g, "").slice(-11);
    if (TOKEN && TOKEN.split(".")[1] === fone) return;
    const r = await api("POST", "/clientes/entrar", { nome: P.nome, whatsapp: P.fone });
    TOKEN = r.token; guarda.por(CHAVE_TOKEN, TOKEN);
    await api("PUT", "/clientes/eu", { nome: P.nome, end: P.end, foto: P.foto }).catch(() => {});
  },
  async enviarPedido(dados) {
    await DADOS.entrarCliente();
    const r = await api("POST", "/agendamentos", dados);
    MEUS = r.bookings; montarCliente(); REV_VISTO = 0;
    return r.booking;
  },
  async salvarPerfil() {
    if (!TOKEN) return false;
    const r = await api("PUT", "/clientes/eu", { nome: S.perfil.nome, end: S.perfil.end, foto: S.perfil.foto });
    Object.assign(S.perfil, { nome: r.perfil.nome, end: r.perfil.end, foto: r.perfil.foto }); return true;
  },
  async criarPix(bid) {
    const r = await api("POST", "/pix/criar", { agendamento_id: bid });
    S.pix = Object.assign({ bid }, r); S.pixFor = bid;
    return r;
  },
  async statusPix() {
    if (!S.pix) return null;
    const r = await api("GET", "/pix/status/" + S.pix.mp_id);
    if (r.status === "approved") { MEUS = (await api("GET", "/meus-agendamentos")).bookings; montarCliente(); }
    return r.status;
  },
  /* painel da dona */
  async entrarSalao(login, senha) {
    const r = await api("POST", "/admin/entrar", { login, senha });
    TOKEN = r.token; guarda.por(CHAVE_TOKEN, TOKEN);
    await recarregar();
  },
  async sairSalao() { try { await api("POST", "/admin/sair"); } catch (_) {} TOKEN = null; guarda.por(CHAVE_TOKEN, null); },
  async salao(metodo, caminho, corpo) {   /* toda ação do painel devolve o estado atualizado */
    const e = await api(metodo, caminho, corpo); aplicarEstado(e); REV_VISTO = e.rev; return e;
  }
};
/* executa uma ação com servidor: mostra o erro em português e redesenha */
async function fazer(acao, ok) {
  if (S.ocupadoAcao) return;
  S.ocupadoAcao = true;
  try { const r = await acao(); S.ocupadoAcao = false; if (ok) ok(r); }
  catch (e) { S.ocupadoAcao = false; toast(msgErro(e && e.erro)); if (e && e.erro === "horario_ocupado") { try { await recarregar(); } catch (_) {} } }
  render();
}

/* ---------------- salvar / carregar (chamados pelo motor de tela) ---------------- */
function salvar() {
  if (!SERVIDOR) return salvarDemo();
  if (MODO !== "cliente") return;
  const d = JSON.stringify({ perfil: S.perfil, cart: S.cart, pay: S.pay, payIn: S.payIn });
  if (d !== ultimoSalvo) { guarda.por(CHAVE_LOCAL, d); ultimoSalvo = d; }
}
function carregar() {
  if (!SERVIDOR) return carregarDemo();
  try { const d = JSON.parse(guarda.ler(CHAVE_LOCAL) || "null"); if (d) { S.perfil = Object.assign(S.perfil, d.perfil || {}); S.cart = d.cart || []; S.pay = d.pay || S.pay; S.payIn = d.payIn || S.payIn; } } catch (_) {}
  return true;
}
window.addEventListener("storage", e => {
  if (SERVIDOR || e.key !== CHAVE) return;
  if (!e.newValue) { location.reload(); return; }
  const ativo = document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
  if (carregarDemo() && !ativo) render();
});

/* ---------------- demonstração em dois aparelhos (link de apresentação no claude.ai) ---------------- */
let docRemoto = null, ultimoRemoto = "", gravando = false, pendenteRemoto = null, timerRemoto = null;
const estadoDemoJSON = () => JSON.stringify({ bookings: S.bookings, lanc: S.lanc, perfil: S.perfil, caixas: S.caixas, avaliacoes: S.avaliacoes, pdi: S.pdi, seq, services: SERVICES, pros: PROS, cats: CATS },
  (k, v) => k === "receipt" ? undefined : v);
function agendarRemoto(dados) {
  if (!docRemoto) return;
  pendenteRemoto = dados; clearTimeout(timerRemoto);
  timerRemoto = setTimeout(gravarRemoto, 400);   /* junta cliques seguidos numa gravação só */
}
async function gravarRemoto() {
  if (!docRemoto || gravando || pendenteRemoto === null || pendenteRemoto === ultimoRemoto) return;
  const dados = pendenteRemoto; pendenteRemoto = null;
  if (dados.length > 240000) { toast("Dados grandes demais para sincronizar (muitas fotos). Zere a demonstração."); return; }
  gravando = true;
  try { await docRemoto.set({ json: dados, em: new Date().toISOString() }); ultimoRemoto = dados; }
  catch (_) { /* sem permissão de escrita (ex.: link aberto por visitante): segue só neste aparelho */ }
  gravando = false;
  if (pendenteRemoto !== null) gravarRemoto();
}
async function ligarCompartilhado() {
  if (!window.claude || typeof window.claude.use !== "function") return;
  let db = null;
  try { db = await window.claude.use("db"); } catch (_) { db = null; }
  if (!db) return;
  docRemoto = db.doc("demo/estado");
  docRemoto.onSnapshot(snap => {
    if (!snap.exists) {
      if (ultimoRemoto) { try { localStorage.removeItem(CHAVE); } catch (_) {} location.reload(); return; }   /* outro aparelho zerou: volta ao início também */
      pendenteRemoto = estadoDemoJSON(); gravarRemoto(); return;   /* primeiro aparelho: semeia */
    }
    const j = (snap.data() || {}).json;
    if (typeof j !== "string" || j === ultimoRemoto || j === ultimoSalvo) { ultimoRemoto = j || ultimoRemoto; return; }
    ultimoRemoto = j;
    try { aplicarDemo(JSON.parse(j)); ultimoSalvo = j; localStorage.setItem(CHAVE, j); } catch (_) { return; }
    const a = document.activeElement;
    if (!(a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName))) render();
  }, () => { docRemoto = null; });
}
window.zerarDemo = async () => {
  try { localStorage.removeItem(CHAVE); } catch (_) {}
  if (docRemoto) { try { await docRemoto.delete(); } catch (_) {} }
  location.reload();
};

/* chamado pela página depois de carregar as partes (cliente, salão ou as duas) */
function iniciar() {
  carregar();
  if (!SERVIDOR) { render(); ligarCompartilhado(); return; }
  /* com servidor: nada de dado de exemplo do núcleo; tudo vem do banco.
     Avaliações e PDI ainda não têm rota no servidor (ver docs/ENTREGA-VPS.md): começam vazias. */
  S.bookings = []; S.lanc = []; S.caixas = {}; S.avaliacoes = []; S.pdi = []; SERVICES.splice(0); PROS.splice(0); CATS = [];
  document.getElementById("root").innerHTML = `<div class="empty" style="margin-top:40vh">Carregando…</div>`;
  const tentar = n => recarregar().then(() => {
    pronto = true;
    S.cart = S.cart.filter(k => { const s = SERVICES.find(x => x.id === +String(k).split(":")[0]); return s && s.disp === "disponivel"; });
    if (CATS.length && !CATS.includes(S.cat)) S.cat = CATS[0];
    render();
  }).catch(e => {
    if (MODO === "salao" && e && e.status === 401) { pronto = true; render(); return; }
    document.getElementById("root").innerHTML = `<div class="empty" style="margin-top:35vh">${msgErro("rede")}</div>`;
    setTimeout(() => tentar(n + 1), Math.min(30000, 3000 * (n + 1)));
  });
  tentar(0);
  setInterval(verificar, 10000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) verificar(); });
}
