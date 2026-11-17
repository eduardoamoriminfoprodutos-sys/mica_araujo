/* ============================================================================
   Servidor do sistema de agendamento para salões — Fastify + Postgres (VPS própria)
   Um processo e um banco POR SALÃO (ambiente exclusivo): nada é compartilhado com outros sistemas.
   Modelo: backend do DM Espetinho (login, Pix do Mercado Pago com webhook idempotente).
   - Cliente: entra com WhatsApp + nome -> token assinado "c1.<whats>.<assinatura>". Vê só os próprios agendamentos.
   - Dona: usuário + senha (hash scrypt) -> sessão "a1.<token>" (30 dias).
   - Preço, duração e horário livre são SEMPRE calculados aqui, nunca vêm do celular.
   - Pix: sem MP_ACCESS_TOKEN no .env o servidor usa um Mercado Pago de mentira (/mp-teste): nenhum dinheiro de verdade.
   As respostas usam o mesmo formato de dados do app (comum/nucleo.js), para o front-end mudar só a camada de dados.
   ============================================================================ */
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (e) {}
const Fastify = require('fastify');
const { Pool } = require('pg');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.PORT || '3020', 10);
const DATABASE_URL = process.env.DATABASE_URL;
const AUTH_SECRET = process.env.AUTH_SECRET || '';
const STATUS_KEY = process.env.STATUS_KEY || '';
const MP_TOKEN = process.env.MP_ACCESS_TOKEN || '';                 // da conta do SALÃO. Vazio = Pix em modo teste
const PIX_TESTE = !MP_TOKEN;
const MP_API = PIX_TESTE ? 'http://127.0.0.1:' + PORT + '/mp-teste' : (process.env.MP_API || 'https://api.mercadopago.com');
const TESTE_KEY = process.env.TESTE_KEY || '';                      // só modo teste: aprovar um Pix de mentira (testes automáticos)
const PUBLIC_URL = process.env.PUBLIC_URL || '';                    // ex.: https://mica.lecomigo.tech (webhook do MP)
const ORIGENS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const TZ = 'America/Belem';

if (!AUTH_SECRET || AUTH_SECRET.length < 32) { console.error('AUTH_SECRET ausente ou curto no .env: o servidor não sobe sem ele.'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
const app = Fastify({ logger: false, bodyLimit: 1024 * 1024 });

app.addHook('onRequest', (req, reply, done) => {
  const o = req.headers.origin;
  if (o && ORIGENS.indexOf(o) >= 0) reply.header('Access-Control-Allow-Origin', o);
  reply.header('Vary', 'Origin');
  reply.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'content-type,authorization');
  reply.header('Access-Control-Max-Age', '86400');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { reply.code(204).send(); return; }
  done();
});
app.setErrorHandler((err, req, reply) => {
  const code = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
  if (code >= 500) console.error('[erro]', req.method, req.url, err && err.message);
  reply.code(code).send({ error: code === 413 ? 'muito_grande' : (code >= 500 ? 'falha' : 'requisicao_invalida') });
});

/* ---------------------------- utilidades ---------------------------- */
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac = s => crypto.createHmac('sha256', AUTH_SECRET).update(String(s)).digest('base64url');
function igual(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
const ipDe = req => String(req.headers['x-real-ip'] || req.ip || '');
function telDig(t) { let d = String(t || '').replace(/\D/g, ''); if (d.length > 11) d = d.slice(-11); return d; }
const foneTxt = d => d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
const normNome = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '');
const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const espera = ms => new Promise(r => setTimeout(r, ms));
const centavos = v => Math.round((Number(v) || 0) * 100);
const reais = c => Math.round(Number(c) || 0) / 100;
function imagemOk(v, max) {
  if (v == null || v === '') return '';
  if (typeof v !== 'string' || v.length > max) return null;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v)) return v;
  return /^https:\/\/[^\s"'<>`]+$/.test(v) && v.length < 2000 ? v : null;
}
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
const toHM = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

/* ---- relógio de Belém ---- */
function partes(d = new Date()) { const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).forEach(x => { p[x.type] = x.value; }); return p; }
const hoje = () => { const p = partes(); return p.year + '-' + p.month + '-' + p.day; };
const agoraMin = () => { const p = partes(); return +p.hour * 60 + +p.minute; };
const hhmm = (d = new Date()) => { const p = partes(d); return p.hour + ':' + p.minute; };
const diaDe = d => { const p = partes(d); return p.year + '-' + p.month + '-' + p.day; };
function addDias(k, n) { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const semana = k => new Date(k + 'T12:00:00Z').getUTCDay();
// primeiro dia de atendimento: hoje, ou amanhã se já passou das 18h; domingo fechado (mesma regra do app)
function d0() { let k = hoje(); if (agoraMin() >= 18 * 60) k = addDias(k, 1); if (semana(k) === 0) k = addDias(k, 1); return k; }
const horizonte = () => addDias(d0(), 27);
const aberto = k => /^\d{4}-\d{2}-\d{2}$/.test(k) && semana(k) !== 0 && k >= d0() && k <= horizonte();
const ymd = v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
function quandoTxt(ts) {   // como o app mostra o histórico: "09:12" hoje, "Ontem" ou "12/11 09:12"
  const k = diaDe(ts), h = hhmm(ts);
  if (k === hoje()) return h;
  if (k === addDias(hoje(), -1)) return 'Ontem ' + h;
  return k.slice(8, 10) + '/' + k.slice(5, 7) + ' ' + h;
}

/* ---- versão dos dados (o app e o painel perguntam só isto a cada 10 s) ---- */
let REV = Date.now();
const mudou = () => { REV = Math.max(Date.now(), REV + 1); };

/* ---- limite de tentativas por IP ---- */
const _rl = new Map();
function limite(req, reply, grupo, max, janelaMs) {
  const k = grupo + '|' + ipDe(req), t = Date.now();
  let e = _rl.get(k);
  if (!e || t > e.fim) { e = { n: 0, fim: t + janelaMs }; _rl.set(k, e); }
  if (++e.n > max) { reply.code(429).send({ error: 'muitas_tentativas', esperaSeg: Math.ceil((e.fim - t) / 1000) }); return false; }
  return true;
}
setInterval(() => { const t = Date.now(); for (const [k, e] of _rl) if (t > e.fim) _rl.delete(k); }, 60000).unref();

/* ============================ LEITURA NO FORMATO DO APP ============================ */
async function lerCats(q = pool) { return (await q.query('select id, nome, ordem from categorias order by ordem, id')).rows; }
function svcApp(r, cats) {
  const c = cats.find(x => x.id === r.categoria_id);
  return { id: r.id, cat: c ? c.nome : '', nome: r.nome, desc: r.descricao, min: r.duracao_min, preco: reais(r.preco_centavos), disp: r.disponibilidade, foto: r.foto_url,
    opcoes: (r.opcoes || []).map(o => ({ nome: o.nome, preco: reais(o.preco_centavos), min: o.duracao_min })) };
}
function proApp(r, cats) {
  return { id: r.id, nome: r.nome, faz: r.descricao, cats: (r.categorias || []).map(id => (cats.find(c => c.id === id) || {}).nome).filter(Boolean), ini: r.inicio, fim: r.fim, cor: r.cor, foto: r.foto_url };
}
async function lerCatalogo(q = pool) {
  const cats = await lerCats(q);
  const sv = (await q.query('select * from servicos order by ordem, id')).rows;
  const pr = (await q.query('select * from profissionais where ativo order by ordem, criado_em')).rows;
  return { cats, services: sv.map(r => svcApp(r, cats)), pros: pr.map(r => proApp(r, cats)), proRows: pr, svcRows: sv };
}
const STATUS_APP = { aguardando_pix: 'pix', aguardando: 'aguardando', aprovado: 'aprovado', reprovado: 'reprovado', concluido: 'aprovado' };
function agApp(r, hist, o = {}) {
  const b = {
    id: r.id, nome: r.cli_nome, fone: foneTxt(r.cli_whats), end: r.cli_end || '', foto: r.cli_foto || '',
    itens: (r.itens || []).map(i => i.chave), pro: r.profissional_id, day: ymd(r.dia), time: r.inicio, fim: r.fim, dur: toMin(r.fim) - toMin(r.inicio),
    obs: r.observacao || '', pay: r.pagamento === 'pix' ? 'pix' : 'salao', payIn: r.pagamento === 'dinheiro' ? 'dinheiro' : 'cartao',
    paid: !!r.pix_pago_em, status: STATUS_APP[r.status] || r.status, motivo: r.motivo || '', refund: !!r.estornado_em, total: reais(r.total_centavos),
    ex: !!r.exemplo, mine: !!o.mine,
    hist: (hist || []).map(h => [quandoTxt(h.quando), h.quem, h.o_que])
  };
  if (r.status === 'aguardando_pix') b.reservaAte = r.reserva_ate;
  if (o.admin && r.pix_pago_em) b.pix = { valor: reais(r.pix_valor_centavos || r.total_centavos), pagoEm: r.pix_pago_em, dia: diaDe(r.pix_pago_em), hora: hhmm(r.pix_pago_em), pagador: r.pix_pagador || r.cli_nome, mpId: r.mp_payment_id || '', teste: !!r.pix_teste, estornoErro: r.estorno_erro || '' };
  return b;
}
const SQL_AG = `select a.*, c.nome as cli_nome, c.whatsapp as cli_whats, c.endereco as cli_end, c.foto_url as cli_foto
  from agendamentos a join clientes c on c.id = a.cliente_id`;
async function lerAgendamentos(where, params, o = {}, q = pool) {
  const rows = (await q.query(SQL_AG + ' where ' + where + ' order by a.dia, a.inicio, a.id', params)).rows;
  if (!rows.length) return [];
  const hs = (await q.query('select agendamento_id, quando, quem, o_que from historico where agendamento_id = any($1) order by quando, id', [rows.map(r => r.id)])).rows;
  return rows.map(r => agApp(r, hs.filter(h => h.agendamento_id === r.id), o));
}
// horários ocupados (sem nome nem dado da cliente): o app da cliente usa para mostrar os horários livres
const BLOQUEIA = "(a.status in ('aguardando','aprovado') or (a.status = 'aguardando_pix' and a.reserva_ate > now()))";
async function lerOcupados(q = pool) {
  return (await q.query(`select a.profissional_id as pro, a.dia, a.inicio, a.fim from agendamentos a where ${BLOQUEIA} and a.dia >= $1 and a.dia <= $2`, [hoje(), horizonte()])).rows
    .map(r => ({ pro: r.pro, day: ymd(r.dia), time: r.inicio, dur: toMin(r.fim) - toMin(r.inicio) }));
}

/* ============================ REGRAS DE HORÁRIO (iguais às do app) ============================ */
// itens da sacola: "id" ou "id:opção". Devolve preço e duração DO SERVIDOR.
function resolverItens(chaves, svcRows, apenasDisponiveis) {
  if (!Array.isArray(chaves) || !chaves.length || chaves.length > 10) return { erro: 'sacola_vazia' };
  const out = [];
  for (const k of chaves) {
    const m = /^(\d{1,9})(?::(\d{1,2}))?$/.exec(String(k));
    if (!m) return { erro: 'item_invalido' };
    const s = svcRows.find(x => x.id === +m[1]);
    if (!s || (apenasDisponiveis && s.disponibilidade !== 'disponivel')) return { erro: 'servico_indisponivel', servico: s ? s.nome : '' };
    if (out.some(x => x.servico_id === s.id)) return { erro: 'item_repetido' };
    const ops = s.opcoes || [];
    if (ops.length && m[2] == null) return { erro: 'escolha_a_opcao', servico: s.nome };
    if (m[2] != null && !ops[+m[2]]) return { erro: 'opcao_invalida', servico: s.nome };
    const op = m[2] != null ? ops[+m[2]] : null;
    out.push({ chave: op ? s.id + ':' + m[2] : String(s.id), servico_id: s.id, categoria_id: s.categoria_id, opcao: op ? +m[2] : null,
      nome: op ? s.nome + ' (' + op.nome + ')' : s.nome, preco_centavos: op ? op.preco_centavos : s.preco_centavos, duracao_min: op ? op.duracao_min : s.duracao_min });
  }
  return { itens: out, total: out.reduce((a, i) => a + i.preco_centavos, 0), dur: out.reduce((a, i) => a + i.duracao_min, 0) };
}
const atende = (p, itens) => itens.every(i => (p.categorias || []).includes(i.categoria_id));
async function horarioLivre(q, p, dia, inicio, dur, excluirId) {
  if (!aberto(dia) || !HM_RE.test(inicio)) return false;
  const t = toMin(inicio), ini = toMin(p.inicio), fim = toMin(p.fim);
  if (t < ini || (t - ini) % 30 !== 0 || t + dur > fim) return false;
  if (dia === hoje() && t <= agoraMin()) return false;
  const ocup = (await q.query(`select a.inicio, a.fim from agendamentos a where a.profissional_id = $1 and a.dia = $2 and ${BLOQUEIA} and a.id <> $3`, [p.id, dia, excluirId || 0])).rows;
  return !ocup.some(o => t < toMin(o.fim) && t + dur > toMin(o.inicio));
}

/* ============================ LOGIN DA CLIENTE ============================ */
const tokenCliente = w => 'c1.' + w + '.' + hmac('cli:' + w);
function lerCliente_(req) {
  const m = /^Bearer c1\.(\d{10,11})\.([A-Za-z0-9_-]{43})$/.exec(String(req.headers.authorization || ''));
  return m && igual(m[2], hmac('cli:' + m[1])) ? m[1] : null;
}
async function exigirCliente(req, reply) {
  const w = lerCliente_(req);
  const c = w ? (await pool.query('select * from clientes where whatsapp = $1', [w])).rows[0] : null;
  if (!c) { reply.code(401).send({ error: 'login_necessario' }); return reply; }
  req.cli = c;
}
const perfilApp = c => ({ nome: c.nome, fone: foneTxt(c.whatsapp), end: c.endereco || '', foto: c.foto_url || '' });
app.post('/clientes/entrar', { bodyLimit: 4096 }, async (req, reply) => {
  if (!limite(req, reply, 'cli-entrar', 20, 10 * 60000)) return;
  const b = req.body || {};
  const w = telDig(b.whatsapp), nome = txt(b.nome, 80).replace(/\s+/g, ' ');
  if (w.length < 10) return reply.code(400).send({ error: 'whats_invalido' });
  if (nome.replace(/\s/g, '').length < 3) return reply.code(400).send({ error: 'nome_invalido' });
  let c = (await pool.query('select * from clientes where whatsapp = $1', [w])).rows[0];
  // quem já tem cadastro entra só com o MESMO nome: assim ninguém vê os horários de outra pessoa digitando o WhatsApp dela
  if (c && normNome(c.nome) !== normNome(nome)) { await espera(300); return reply.code(403).send({ error: 'nome_diferente' }); }
  if (!c) c = (await pool.query('insert into clientes (nome, whatsapp) values ($1, $2) on conflict (whatsapp) do update set atualizado_em = now() returning *', [nome, w])).rows[0];
  return { ok: true, token: tokenCliente(w), perfil: perfilApp(c) };
});
app.get('/clientes/eu', { onRequest: exigirCliente }, async req => ({ perfil: perfilApp(req.cli) }));
app.put('/clientes/eu', { onRequest: exigirCliente, bodyLimit: 900 * 1024 }, async (req, reply) => {
  if (!limite(req, reply, 'cli-put', 60, 10 * 60000)) return;
  const b = req.body || {};
  const foto = imagemOk(b.foto, 800 * 1024);
  if (foto === null) return reply.code(400).send({ error: 'foto_invalida' });
  const nome = txt(b.nome, 80).replace(/\s+/g, ' ');
  const c = (await pool.query("update clientes set nome = coalesce(nullif($2, ''), nome), endereco = $3, foto_url = $4, atualizado_em = now() where id = $1 returning *", [req.cli.id, nome, txt(b.end, 160), foto])).rows[0];
  mudou();
  return { ok: true, perfil: perfilApp(c) };
});

/* ============================ PÚBLICO: catálogo e horários ============================ */
app.get('/health', async () => ({ ok: true, ts: Date.now() }));
app.get('/rev', async () => ({ rev: REV }));
app.get('/catalogo', async () => {
  const c = await lerCatalogo();
  return { rev: REV, cats: c.cats.map(x => x.nome), services: c.services, pros: c.pros, ocupados: await lerOcupados(), hoje: hoje(), d0: d0(), pixTeste: PIX_TESTE };
});
app.get('/horarios', async (req, reply) => {
  const q = req.query || {}, dia = String(q.dia || ''), c = await lerCatalogo();
  const r = resolverItens(String(q.itens || '').split(',').filter(Boolean), c.svcRows, true);
  if (r.erro) return reply.code(400).send({ error: r.erro });
  const ps = c.proRows.filter(p => (q.profissional && q.profissional !== 'qualquer' ? p.id === q.profissional : true) && atende(p, r.itens));
  const todos = {};
  for (const p of ps) for (let t = toMin(p.inicio); t + r.dur <= toMin(p.fim); t += 30) {
    const h = toHM(t); if (await horarioLivre(pool, p, dia, h, r.dur)) todos[h] = todos[h] || p.id; else if (!(h in todos)) todos[h] = null;
  }
  return { dia, horarios: Object.keys(todos).sort().map(t => ({ t, free: !!todos[t], pro: todos[t] })) };
});

/* ============================ AGENDAMENTOS DA CLIENTE ============================ */
async function meus(clienteId) { return lerAgendamentos('a.cliente_id = $1 and a.dia >= $2', [clienteId, addDias(hoje(), -120)], { mine: true }); }
app.get('/meus-agendamentos', { onRequest: exigirCliente }, async req => ({ rev: REV, bookings: await meus(req.cli.id) }));
app.post('/agendamentos', { onRequest: exigirCliente, bodyLimit: 16 * 1024 }, async (req, reply) => {
  if (!limite(req, reply, 'agendar', 30, 10 * 60000)) return;
  const b = req.body || {};
  const dia = String(b.dia || ''), hora = String(b.hora || '');
  const pagamento = b.pagamento === 'pix' ? 'pix' : (b.pagarNoSalao === 'dinheiro' ? 'dinheiro' : 'cartao');
  if (!aberto(dia)) return reply.code(400).send({ error: 'dia_fechado' });
  const cl = await pool.connect();
  try {
    await cl.query('begin');
    await cl.query('select pg_advisory_xact_lock(hashtext($1))', ['agenda:' + dia]);   // dois pedidos ao mesmo tempo no mesmo dia: um de cada vez
    const c = await lerCatalogo(cl);
    const r = resolverItens(b.itens, c.svcRows, true);
    if (r.erro) { await cl.query('rollback'); return reply.code(400).send({ error: r.erro, servico: r.servico || '' }); }
    const cands = c.proRows.filter(p => atende(p, r.itens) && (b.profissional && b.profissional !== 'qualquer' ? p.id === b.profissional : true));
    let p = null;
    for (const x of cands) if (await horarioLivre(cl, x, dia, hora, r.dur)) { p = x; break; }
    if (!p) { await cl.query('rollback'); return reply.code(409).send({ error: cands.length ? 'horario_ocupado' : 'sem_profissional' }); }
    const pix = pagamento === 'pix';
    const ag = (await cl.query(`insert into agendamentos (cliente_id, profissional_id, dia, inicio, fim, itens, total_centavos, pagamento, status, observacao, reserva_ate)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, ${pix ? "now() + interval '30 minutes'" : 'null'}) returning id`,
      [req.cli.id, p.id, dia, hora, toHM(toMin(hora) + r.dur), JSON.stringify(r.itens), r.total, pagamento, pix ? 'aguardando_pix' : 'aguardando', txt(b.observacao, 400)])).rows[0];
    await cl.query("insert into historico (agendamento_id, quem, o_que) values ($1, 'Cliente', 'Pedido criado')", [ag.id]);
    await cl.query('commit'); mudou();
    const bookings = await meus(req.cli.id);
    return { ok: true, id: ag.id, booking: bookings.find(x => x.id === ag.id), bookings };
  } catch (e) { try { await cl.query('rollback'); } catch (x) {} throw e; }
  finally { cl.release(); }
});

/* ============================ PIX (Mercado Pago; modo teste sem token) ============================ */
async function mp(metodo, caminho, corpo, idem) {
  const h = { Authorization: 'Bearer ' + (MP_TOKEN || 'teste'), 'Content-Type': 'application/json' };
  if (idem) h['X-Idempotency-Key'] = idem;
  const r = await fetch(MP_API + caminho, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
function pagadorDe(pay) {
  const bi = pay && pay.point_of_interaction && pay.point_of_interaction.transaction_data && pay.point_of_interaction.transaction_data.bank_info;
  const n = bi && bi.payer && bi.payer.long_name;
  return txt(n || '', 80);
}
// devolve um Pix. doPedido = true: é o Pix do próprio pedido (reprovado); false: pagamento a mais (em dobro ou depois de reprovado)
async function estornar(agId, mpId, motivo, doPedido = true) {
  const r = await mp('POST', '/v1/payments/' + mpId + '/refunds', {}, 'estorno-' + mpId);
  if (r.ok) {
    await pool.query("update pix_cobrancas set status = 'estornado' where mp_id = $1", [String(mpId)]);
    if (doPedido) await pool.query("update agendamentos set estornado_em = now(), estorno_erro = null, atualizado_em = now() where id = $1", [agId]);
    await pool.query("insert into historico (agendamento_id, quem, o_que) values ($1, 'Sistema', $2)", [agId, 'Pix devolvido pelo Mercado Pago' + (motivo ? ' (' + motivo + ')' : '')]);
    return true;
  }
  const erro = txt((r.j && (r.j.message || r.j.error)) || ('erro ' + r.status), 200);
  await pool.query('update agendamentos set estorno_erro = $2, atualizado_em = now() where id = $1', [agId, erro]);
  await pool.query("insert into historico (agendamento_id, quem, o_que) values ($1, 'Sistema', 'Não consegui devolver o Pix automaticamente: devolva pelo app do Mercado Pago')", [agId]);
  console.error('[estorno]', agId, mpId, erro);
  return false;
}
/* Confirma um pagamento consultando o Mercado Pago. Idempotente: o webhook pode repetir à vontade. */
async function confirmarPagamento(mpId) {
  if (!/^\d{1,20}$/.test(String(mpId || ''))) return { ok: false };
  const cob = (await pool.query('select * from pix_cobrancas where mp_id = $1', [String(mpId)])).rows[0];
  if (!cob) return { ok: true, status: 'unknown' };                 // cobrança que não é nossa: nem consulta o MP
  const r = await mp('GET', '/v1/payments/' + mpId);
  const pay = r.ok ? r.j : null;
  if (!pay || !pay.status) return { ok: false };
  let duplicado = false;
  const cl = await pool.connect();
  try {
    await cl.query('begin');
    const c2 = (await cl.query('select * from pix_cobrancas where mp_id = $1 for update', [String(mpId)])).rows[0];
    if (pay.status !== c2.status) await cl.query('update pix_cobrancas set status = $2 where mp_id = $1', [String(mpId), pay.status]);
    const ag = (await cl.query('select * from agendamentos where id = $1 for update', [c2.agendamento_id])).rows[0];
    if (pay.status === 'approved') {
      if (centavos(pay.transaction_amount) + 1 < c2.valor_centavos) {   // pagou menos do que o servidor cobrou
        await cl.query("update pix_cobrancas set status = 'valor_divergente' where mp_id = $1", [String(mpId)]);
        await cl.query('commit'); return { ok: true, status: 'valor_divergente' };
      }
      if (!c2.pago_em) await cl.query('update pix_cobrancas set pago_em = now() where mp_id = $1', [String(mpId)]);
      if (ag.status === 'aguardando_pix' && !ag.pix_pago_em) {
        await cl.query(`update agendamentos set status = 'aguardando', pix_pago_em = now(), pix_valor_centavos = $2, pix_pagador = $3, mp_payment_id = $4,
          pix_teste = $5, reserva_ate = null, atualizado_em = now() where id = $1`, [ag.id, centavos(pay.transaction_amount), pagadorDe(pay), String(mpId), !!c2.teste]);
        await cl.query("insert into historico (agendamento_id, quem, o_que) values ($1, 'Sistema', $2)", [ag.id, c2.teste ? 'Pix confirmado (modo teste, sem dinheiro de verdade)' : 'Pix confirmado pelo Mercado Pago']);
        mudou();
      } else if (!(ag.pix_pago_em && ag.mp_payment_id === String(mpId)) && c2.status !== 'estornado') duplicado = true;   // pagou em dobro ou depois de reprovado: devolve
    }
    await cl.query('commit');
  } catch (e) { try { await cl.query('rollback'); } catch (x) {} console.error('[pix-confirmar]', e && e.message); return { ok: false }; }
  finally { cl.release(); }
  if (duplicado) { await estornar(cob.agendamento_id, String(mpId), 'pagamento a mais', false); mudou(); }
  return { ok: true, status: pay.status };
}
app.post('/pix/criar', { onRequest: exigirCliente, bodyLimit: 4096 }, async (req, reply) => {
  if (!limite(req, reply, 'pix-criar', 20, 10 * 60000)) return;
  const id = parseInt((req.body || {}).agendamento_id, 10);
  const ag = (await pool.query('select * from agendamentos where id = $1 and cliente_id = $2', [id, req.cli.id])).rows[0];
  if (!ag) return reply.code(404).send({ error: 'nao_encontrado' });
  if (ag.status !== 'aguardando_pix' || ag.pix_pago_em) return reply.code(409).send({ error: 'ja_pago_ou_fechado' });
  // reserva vencida: o horário pode ter sido ocupado por outra cliente
  if (!(ag.reserva_ate && new Date(ag.reserva_ate) > new Date())) {
    const p = (await pool.query('select * from profissionais where id = $1', [ag.profissional_id])).rows[0];
    if (!p || !(await horarioLivre(pool, p, ymd(ag.dia), ag.inicio, toMin(ag.fim) - toMin(ag.inicio), ag.id))) return reply.code(409).send({ error: 'horario_ocupado' });
    await pool.query("update agendamentos set reserva_ate = now() + interval '30 minutes' where id = $1", [ag.id]);
  }
  // reaproveita uma cobrança ainda válida (até 25 min) em vez de criar outra
  const viva = (await pool.query("select mp_id from pix_cobrancas where agendamento_id = $1 and status = 'pending' and criado_em > now() - interval '25 minutes' order by criado_em desc limit 1", [ag.id])).rows[0];
  const exp = new Date(Date.now() + 30 * 60000).toISOString().replace('Z', '-00:00');
  let pay;
  if (viva) { const r = await mp('GET', '/v1/payments/' + viva.mp_id); pay = r.ok ? r.j : null; }
  if (!pay || pay.status !== 'pending') {
    const host = (() => { try { return new URL(PUBLIC_URL).hostname; } catch (e) { return 'cliente.app'; } })();
    const r = await mp('POST', '/v1/payments', {
      transaction_amount: reais(ag.total_centavos), payment_method_id: 'pix', description: 'Agendamento #' + ag.id, date_of_expiration: exp,
      notification_url: PUBLIC_URL ? PUBLIC_URL + '/pix/webhook' : undefined,
      payer: { email: 'cliente' + req.cli.whatsapp + '@' + host, first_name: (req.cli.nome.split(' ')[0] || 'Cliente') }
    }, 'ag-' + ag.id + '-' + Date.now());
    if (!r.ok || !r.j.id) { console.error('[pix-criar]', r.status, r.j && r.j.message); return reply.code(502).send({ error: 'falha_pix' }); }
    pay = r.j;
    await pool.query('insert into pix_cobrancas (mp_id, agendamento_id, valor_centavos, status, teste) values ($1,$2,$3,$4,$5) on conflict (mp_id) do nothing', [String(pay.id), ag.id, ag.total_centavos, pay.status || 'pending', PIX_TESTE]);
    await pool.query('update agendamentos set mp_payment_id = $2 where id = $1', [ag.id, String(pay.id)]);
  }
  const tx = (pay.point_of_interaction && pay.point_of_interaction.transaction_data) || {};
  return { ok: true, mp_id: String(pay.id), valor: reais(ag.total_centavos), copia_e_cola: tx.qr_code || '', qr_base64: tx.qr_code_base64 || '', teste: PIX_TESTE };
});
app.get('/pix/status/:mp_id', { onRequest: exigirCliente }, async (req, reply) => {
  if (!limite(req, reply, 'pix-status', 90, 60000)) return;
  const id = String(req.params.mp_id || '');
  if (!/^\d{1,20}$/.test(id)) return reply.code(400).send({ error: 'id_invalido' });
  const cob = (await pool.query('select p.* from pix_cobrancas p join agendamentos a on a.id = p.agendamento_id where p.mp_id = $1 and a.cliente_id = $2', [id, req.cli.id])).rows[0];
  if (!cob) return reply.code(404).send({ error: 'nao_encontrado' });
  const r = await confirmarPagamento(id);
  return { ok: !!r.ok, status: r.status || 'unknown', agendamento_id: cob.agendamento_id };
});
app.post('/pix/webhook', { bodyLimit: 64 * 1024 }, async (req, reply) => {
  reply.code(200).send({ ok: true });
  try {
    const q = req.query || {}, body = req.body || {};
    const id = body.data && body.data.id ? body.data.id : (q['data.id'] || q.id);
    const tipo = body.type || q.type || q.topic;
    if (id && (!tipo || tipo === 'payment')) await confirmarPagamento(String(id));
  } catch (e) {}
});

/* ---- Mercado Pago de mentira (só sem MP_ACCESS_TOKEN): nenhum dinheiro de verdade passa por aqui ---- */
const mpTeste = { n: 7000000000, pag: {} };
const soInterno = req => !req.headers['x-real-ip'] && /^(::ffff:)?127\.0\.0\.1$|^::1$/.test(req.ip);
if (PIX_TESTE) {
  app.post('/mp-teste/v1/payments', async (req, reply) => {
    if (!soInterno(req)) return reply.code(404).send({ error: 'nao_encontrado' });
    const b = req.body || {}, id = ++mpTeste.n;
    const code = '00020126' + 'PIX-DE-TESTE-SEM-DINHEIRO-' + id + '-VALOR-' + Number(b.transaction_amount).toFixed(2);
    mpTeste.pag[id] = { id, status: 'pending', transaction_amount: Number(b.transaction_amount), description: b.description, point_of_interaction: { transaction_data: { qr_code: code, qr_code_base64: '', bank_info: { payer: { long_name: '' } } } } };
    return reply.code(201).send(mpTeste.pag[id]);
  });
  app.get('/mp-teste/v1/payments/:id', async (req, reply) => {
    if (!soInterno(req)) return reply.code(404).send({ error: 'nao_encontrado' });
    const p = mpTeste.pag[req.params.id]; return p ? p : reply.code(404).send({ error: 'nao_encontrado' });
  });
  app.post('/mp-teste/v1/payments/:id/refunds', async (req, reply) => {
    if (!soInterno(req)) return reply.code(404).send({ error: 'nao_encontrado' });
    const p = mpTeste.pag[req.params.id]; if (!p || p.status !== 'approved') return reply.code(400).send({ message: 'pagamento nao aprovado' });
    p.status = 'refunded'; return reply.code(201).send({ id: Date.now(), payment_id: p.id, status: 'approved' });
  });
  // testes automáticos: "pagar" um Pix de mentira (exige a TESTE_KEY do .env)
  app.post('/mp-teste/aprovar/:id', async (req, reply) => {
    if (!TESTE_KEY || !igual(String(req.headers['x-teste-key'] || ''), TESTE_KEY)) return reply.code(404).send({ error: 'nao_encontrado' });
    const p = mpTeste.pag[req.params.id]; if (!p) return reply.code(404).send({ error: 'nao_encontrado' });
    p.status = 'approved'; p.point_of_interaction.transaction_data.bank_info.payer.long_name = 'Pagador de teste';
    await confirmarPagamento(String(p.id));
    return { ok: true };
  });
}

/* ============================ LOGIN DA DONA ============================ */
const hashSenha = (senha, salt) => new Promise((ok, falha) => crypto.scrypt(String(senha), salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? falha(e) : ok(k.toString('hex'))));
async function exigirAdmin(req, reply) {
  const m = /^Bearer a1\.([0-9a-f]{64})$/.exec(String(req.headers.authorization || ''));
  const u = m ? (await pool.query('select s.token_hash, a.id, a.nome, a.login from admin_sessoes s join admins a on a.id = s.admin_id where s.token_hash = $1 and s.expira_em > now() and a.ativo', [sha256(m[1])])).rows[0] : null;
  if (!u) { reply.code(401).send({ error: 'login_necessario' }); return reply; }
  req.adm = u;
}
const _falhas = new Map();
const SENHA_FALSA = { salt: 'x'.repeat(32), senha_hash: '0'.repeat(128) };
app.post('/admin/entrar', { bodyLimit: 4096 }, async (req, reply) => {
  const ip = ipDe(req), t = Date.now(), f = _falhas.get(ip);
  if (f && t < f.fim && f.n >= 5) return reply.code(429).send({ error: 'muitas_tentativas', esperaSeg: Math.ceil((f.fim - t) / 1000) });
  const b = req.body || {}, login = txt(b.login, 40).toLowerCase(), senha = String(b.senha || '').slice(0, 200);
  const u = login ? (await pool.query('select * from admins where login = $1 and ativo', [login])).rows[0] : null;
  const ref = u || SENHA_FALSA, h = await hashSenha(senha, ref.salt);
  if (!u || !senha || !igual(h, ref.senha_hash)) {
    const e = (f && t < f.fim) ? f : { n: 0, fim: t + 15 * 60000 }; e.n++; _falhas.set(ip, e);
    console.warn('[login-falhou]', new Date().toISOString(), 'login=' + login, 'ip=' + ip, 'tentativa=' + e.n);
    await espera(500); return reply.code(401).send({ error: 'usuario_ou_senha' });
  }
  _falhas.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query("insert into admin_sessoes (token_hash, admin_id, expira_em, ip) values ($1, $2, now() + interval '30 days', $3)", [sha256(token), u.id, ip]);
  pool.query('delete from admin_sessoes where expira_em < now()').catch(() => {});
  return { ok: true, token: 'a1.' + token, nome: u.nome };
});
app.post('/admin/sair', { onRequest: exigirAdmin, bodyLimit: 1024 }, async req => { await pool.query('delete from admin_sessoes where token_hash = $1', [req.adm.token_hash]); return { ok: true }; });
app.post('/admin/senha', { onRequest: exigirAdmin, bodyLimit: 4096 }, async (req, reply) => {
  const b = req.body || {}, atual = String(b.atual || '').slice(0, 200), nova = String(b.nova || '').slice(0, 200);
  if (nova.length < 8) return reply.code(400).send({ error: 'senha_curta' });
  const u = (await pool.query('select * from admins where id = $1', [req.adm.id])).rows[0];
  if (!igual(await hashSenha(atual, u.salt), u.senha_hash)) { await espera(500); return reply.code(403).send({ error: 'senha_atual_errada' }); }
  const salt = crypto.randomBytes(16).toString('hex');
  await pool.query('update admins set salt = $2, senha_hash = $3, atualizado_em = now() where id = $1', [u.id, salt, await hashSenha(nova, salt)]);
  await pool.query('delete from admin_sessoes where admin_id = $1 and token_hash <> $2', [u.id, req.adm.token_hash]);
  return { ok: true };
});

/* ============================ PAINEL DA DONA ============================ */
async function estadoAdmin() {
  const c = await lerCatalogo(), desde = addDias(hoje(), -60);
  const bookings = await lerAgendamentos("a.dia >= $1 and a.status <> 'aguardando_pix'", [desde], { admin: true });
  const lanc = (await pool.query('select l.*, a.itens as ag_itens from lancamentos l left join agendamentos a on a.id = l.agendamento_id where l.dia >= $1 order by l.aprovado_em, l.id', [desde])).rows
    .map(l => ({ id: l.id, bid: l.agendamento_id, forma: l.forma, valor: reais(l.valor_centavos), nome: l.nome, itens: (l.ag_itens || l.itens || []).map(i => i.chave || String(i)), at: hhmm(l.aprovado_em), day: ymd(l.dia), ex: !!l.exemplo }));
  const caixas = {};
  (await pool.query('select * from caixas where dia >= $1', [desde])).rows.forEach(x => { caixas[ymd(x.dia)] = { at: hhmm(x.fechado_em), total: reais(x.total) }; });
  return { rev: REV, hoje: hoje(), bookings, lanc, caixas, cats: c.cats.map(x => x.nome), services: c.services, pros: c.pros, pixTeste: PIX_TESTE };
}
app.get('/admin/estado', { onRequest: exigirAdmin }, async () => estadoAdmin());
app.get('/admin/pedidos', { onRequest: exigirAdmin }, async req => {
  const st = (req.query || {}).status || 'aguardando';
  return { pedidos: await lerAgendamentos('a.status = $1', [st], { admin: true }) };
});
app.get('/admin/agendamentos/:id', { onRequest: exigirAdmin }, async (req, reply) => {
  const r = await lerAgendamentos('a.id = $1', [parseInt(req.params.id, 10) || 0], { admin: true });
  return r[0] || reply.code(404).send({ error: 'nao_encontrado' });
});
app.get('/admin/agenda', { onRequest: exigirAdmin }, async req => {
  const q = req.query || {}, dia = /^\d{4}-\d{2}-\d{2}$/.test(q.dia || '') ? q.dia : hoje();
  const lista = await lerAgendamentos("a.dia = $1 and a.status = 'aprovado'", [dia], { admin: true });
  return { dia, agenda: q.profissional && q.profissional !== 'todas' ? lista.filter(b => b.pro === q.profissional) : lista };
});
app.get('/admin/financeiro', { onRequest: exigirAdmin }, async req => {
  const q = req.query || {}, dia = /^\d{4}-\d{2}-\d{2}$/.test(q.dia || '') ? q.dia : hoje(), e = await estadoAdmin();
  return { dia, lancamentos: e.lanc.filter(l => l.day === dia), caixa: e.caixas[dia] || null };
});
async function mudarStatus(req, reply, fn) {
  const id = parseInt(req.params.id, 10) || 0;
  const cl = await pool.connect();
  let depois = null;
  try {
    await cl.query('begin');
    const ag = (await cl.query(SQL_AG + ' where a.id = $1 for update of a', [id])).rows[0];
    if (!ag) { await cl.query('rollback'); return reply.code(404).send({ error: 'nao_encontrado' }); }
    const r = await fn(cl, ag);
    if (r && r.erro) { await cl.query('rollback'); return reply.code(409).send({ error: r.erro }); }
    depois = r && r.depois;
    await cl.query('commit'); mudou();
  } catch (e) { try { await cl.query('rollback'); } catch (x) {} throw e; }
  finally { cl.release(); }
  if (depois) await depois();
  return estadoAdmin();
}
app.post('/admin/agendamentos/:id/aprovar', { onRequest: exigirAdmin, bodyLimit: 1024 }, async (req, reply) => mudarStatus(req, reply, async (cl, ag) => {
  if (ag.status !== 'aguardando') return { erro: 'nao_esta_aguardando' };
  await cl.query("update agendamentos set status = 'aprovado', atualizado_em = now() where id = $1", [ag.id]);
  await cl.query('insert into lancamentos (agendamento_id, forma, valor_centavos, dia, nome, itens) values ($1,$2,$3,$4,$5,$6) on conflict (agendamento_id) do nothing',
    [ag.id, ag.pagamento, ag.total_centavos, hoje(), ag.cli_nome, JSON.stringify(ag.itens)]);
  await cl.query("insert into historico (agendamento_id, quem, o_que) values ($1, 'Dona', 'Aprovou o agendamento')", [ag.id]);
}));
app.post('/admin/agendamentos/:id/reprovar', { onRequest: exigirAdmin, bodyLimit: 4096 }, async (req, reply) => {
  const motivo = txt((req.body || {}).motivo, 120);
  if (!motivo) return reply.code(400).send({ error: 'motivo_obrigatorio' });
  return mudarStatus(req, reply, async (cl, ag) => {
    if (ag.status !== 'aguardando' && ag.status !== 'aguardando_pix') return { erro: 'nao_esta_aguardando' };
    await cl.query("update agendamentos set status = 'reprovado', motivo = $2, reserva_ate = null, atualizado_em = now() where id = $1", [ag.id, motivo]);
    await cl.query("insert into historico (agendamento_id, quem, o_que) values ($1, 'Dona', $2)", [ag.id, 'Reprovou: ' + motivo]);
    if (ag.pix_pago_em && !ag.estornado_em && ag.mp_payment_id) return { depois: () => estornar(ag.id, ag.mp_payment_id, '', true) };
  });
});
app.post('/admin/caixa/fechar', { onRequest: exigirAdmin, bodyLimit: 1024 }, async (req, reply) => {
  const dia = String((req.body || {}).dia || (req.query || {}).dia || hoje());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || dia > hoje()) return reply.code(400).send({ error: 'dia_invalido' });
  const cl = await pool.connect();
  try {
    await cl.query('begin');
    if ((await cl.query('select 1 from caixas where dia = $1', [dia])).rows[0]) { await cl.query('rollback'); return reply.code(409).send({ error: 'caixa_ja_fechado' }); }
    const ls = (await cl.query('select forma, valor_centavos from lancamentos where dia = $1 for update', [dia])).rows;
    if (!ls.length) { await cl.query('rollback'); return reply.code(400).send({ error: 'sem_lancamentos' }); }
    const t = f => ls.filter(l => l.forma === f).reduce((a, l) => a + l.valor_centavos, 0);
    const cx = (await cl.query('insert into caixas (dia, total_pix, total_cartao, total_dinheiro, total) values ($1,$2,$3,$4,$5) returning id', [dia, t('pix'), t('cartao'), t('dinheiro'), t('pix') + t('cartao') + t('dinheiro')])).rows[0];
    await cl.query('update lancamentos set caixa_id = $2 where dia = $1', [dia, cx.id]);
    await cl.query('commit'); mudou();
  } catch (e) { try { await cl.query('rollback'); } catch (x) {} throw e; }
  finally { cl.release(); }
  return estadoAdmin();
});

/* ---- serviços ---- */
const MINS_OK = m => Number.isInteger(m) && m >= 5 && m <= 720;
async function dadosServico(b, reply) {
  const cats = await lerCats(), cat = cats.find(c => c.nome === b.cat);
  const nome = txt(b.nome, 80), min = parseInt(b.min, 10), preco = Number(b.preco), foto = imagemOk(b.foto, 800 * 1024);
  if (!nome) { reply.code(400).send({ error: 'nome_obrigatorio' }); return null; }
  if (!cat) { reply.code(400).send({ error: 'categoria_invalida' }); return null; }
  if (!MINS_OK(min) || !(preco >= 0 && preco <= 100000)) { reply.code(400).send({ error: 'preco_ou_duracao_invalido' }); return null; }
  if (foto === null) { reply.code(400).send({ error: 'foto_invalida' }); return null; }
  const disp = ['disponivel', 'pausado', 'oculto', 'arquivado'].includes(b.disp) ? b.disp : 'disponivel';
  const opcoes = (Array.isArray(b.opcoes) ? b.opcoes : []).slice(0, 10).map(o => ({ nome: txt(o && o.nome, 40), preco_centavos: centavos(o && o.preco), duracao_min: parseInt(o && o.min, 10) }))
    .filter(o => o.nome && o.preco_centavos >= 0 && MINS_OK(o.duracao_min));
  return { categoria_id: cat.id, nome, descricao: txt(b.desc, 300), duracao_min: min, preco_centavos: centavos(preco), disponibilidade: disp, foto_url: foto, opcoes: JSON.stringify(opcoes) };
}
app.post('/admin/servicos', { onRequest: exigirAdmin, bodyLimit: 900 * 1024 }, async (req, reply) => {
  const d = await dadosServico(req.body || {}, reply); if (!d) return;
  const r = (await pool.query(`insert into servicos (categoria_id, nome, descricao, duracao_min, preco_centavos, disponibilidade, foto_url, opcoes, ordem)
    values ($1,$2,$3,$4,$5,$6,$7,$8, (select coalesce(max(ordem),0)+1 from servicos)) returning id`, [d.categoria_id, d.nome, d.descricao, d.duracao_min, d.preco_centavos, d.disponibilidade, d.foto_url, d.opcoes])).rows[0];
  mudou(); return Object.assign(await estadoAdmin(), { id: r.id });
});
app.put('/admin/servicos/:id', { onRequest: exigirAdmin, bodyLimit: 900 * 1024 }, async (req, reply) => {
  const id = parseInt(req.params.id, 10) || 0, atual = (await pool.query('select * from servicos where id = $1', [id])).rows[0];
  if (!atual) return reply.code(404).send({ error: 'nao_encontrado' });
  const b = req.body || {};
  if (Object.keys(b).length === 1 && b.disp) {   // só ligar/desligar (pausado, arquivado...)
    if (!['disponivel', 'pausado', 'oculto', 'arquivado'].includes(b.disp)) return reply.code(400).send({ error: 'disp_invalida' });
    await pool.query('update servicos set disponibilidade = $2, atualizado_em = now() where id = $1', [id, b.disp]);
  } else {
    const d = await dadosServico(b, reply); if (!d) return;
    await pool.query('update servicos set categoria_id=$2, nome=$3, descricao=$4, duracao_min=$5, preco_centavos=$6, disponibilidade=$7, foto_url=$8, opcoes=$9, atualizado_em=now() where id=$1',
      [id, d.categoria_id, d.nome, d.descricao, d.duracao_min, d.preco_centavos, d.disponibilidade, d.foto_url, d.opcoes]);
  }
  mudou(); return estadoAdmin();
});
/* ---- categorias ---- */
app.post('/admin/categorias', { onRequest: exigirAdmin, bodyLimit: 4096 }, async (req, reply) => {
  const nome = txt((req.body || {}).nome, 40);
  if (!nome) return reply.code(400).send({ error: 'nome_obrigatorio' });
  if ((await lerCats()).some(c => normNome(c.nome) === normNome(nome))) return reply.code(409).send({ error: 'categoria_existe' });
  await pool.query('insert into categorias (nome, ordem) values ($1, (select coalesce(max(ordem),0)+1 from categorias))', [nome]);
  mudou(); return estadoAdmin();
});
app.put('/admin/categorias', { onRequest: exigirAdmin, bodyLimit: 4096 }, async (req, reply) => {
  const b = req.body || {}, de = txt(b.de, 40), para = txt(b.para, 40), cats = await lerCats();
  const c = cats.find(x => x.nome === de);
  if (!c || !para) return reply.code(400).send({ error: 'categoria_invalida' });
  if (cats.some(x => x.id !== c.id && normNome(x.nome) === normNome(para))) return reply.code(409).send({ error: 'categoria_existe' });
  await pool.query('update categorias set nome = $2 where id = $1', [c.id, para]);   // serviços e equipe apontam pelo número: mudam juntos
  mudou(); return estadoAdmin();
});
app.post('/admin/categorias/excluir', { onRequest: exigirAdmin, bodyLimit: 4096 }, async (req, reply) => {
  const nome = txt((req.body || {}).nome, 40), cats = await lerCats(), c = cats.find(x => x.nome === nome);
  if (!c) return reply.code(404).send({ error: 'nao_encontrado' });
  if (cats.length === 1) return reply.code(409).send({ error: 'ultima_categoria' });
  if ((await pool.query("select 1 from servicos where categoria_id = $1 and disponibilidade <> 'arquivado' limit 1", [c.id])).rows[0]) return reply.code(409).send({ error: 'categoria_com_servicos' });
  const outra = cats.find(x => x.id !== c.id);
  await pool.query('update servicos set categoria_id = $2 where categoria_id = $1', [c.id, outra.id]);   // arquivados ficam guardados em outra categoria
  await pool.query('update profissionais set categorias = array_remove(categorias, $1)', [c.id]);
  await pool.query('delete from categorias where id = $1', [c.id]);
  mudou(); return estadoAdmin();
});
/* ---- equipe ---- */
async function dadosPro(b, reply) {
  const cats = await lerCats(), ids = (Array.isArray(b.cats) ? b.cats : []).map(n => (cats.find(c => c.nome === n) || {}).id).filter(Boolean);
  const nome = txt(b.nome, 60), foto = imagemOk(b.foto, 800 * 1024), ini = String(b.ini || ''), fim = String(b.fim || '');
  if (!nome) { reply.code(400).send({ error: 'nome_obrigatorio' }); return null; }
  if (!ids.length) { reply.code(400).send({ error: 'sem_especialidade' }); return null; }
  if (!HM_RE.test(ini) || !HM_RE.test(fim) || toMin(fim) - toMin(ini) < 60) { reply.code(400).send({ error: 'expediente_invalido' }); return null; }
  if (foto === null) { reply.code(400).send({ error: 'foto_invalida' }); return null; }
  const cor = /^#[0-9A-Fa-f]{6}$/.test(String(b.cor || '')) ? b.cor : '#C99A87';
  return { nome, foto_url: foto, cor, categorias: ids, descricao: txt(b.faz, 80) || ids.map(id => cats.find(c => c.id === id).nome).join(', '), inicio: ini, fim };
}
app.post('/admin/profissionais', { onRequest: exigirAdmin, bodyLimit: 900 * 1024 }, async (req, reply) => {
  const d = await dadosPro(req.body || {}, reply); if (!d) return;
  const id = 'p' + crypto.randomBytes(4).toString('hex');
  await pool.query('insert into profissionais (id, nome, foto_url, cor, categorias, descricao, inicio, fim, ordem) values ($1,$2,$3,$4,$5,$6,$7,$8,(select coalesce(max(ordem),0)+1 from profissionais))',
    [id, d.nome, d.foto_url, d.cor, d.categorias, d.descricao, d.inicio, d.fim]);
  mudou(); return Object.assign(await estadoAdmin(), { id });
});
app.put('/admin/profissionais/:id', { onRequest: exigirAdmin, bodyLimit: 900 * 1024 }, async (req, reply) => {
  const d = await dadosPro(req.body || {}, reply); if (!d) return;
  const r = await pool.query('update profissionais set nome=$2, foto_url=$3, cor=$4, categorias=$5, descricao=$6, inicio=$7, fim=$8 where id=$1 and ativo', [String(req.params.id), d.nome, d.foto_url, d.cor, d.categorias, d.descricao, d.inicio, d.fim]);
  if (!r.rowCount) return reply.code(404).send({ error: 'nao_encontrado' });
  mudou(); return estadoAdmin();
});
app.delete('/admin/profissionais/:id', { onRequest: exigirAdmin }, async (req, reply) => {
  const id = String(req.params.id);
  const abertos = (await pool.query("select count(*)::int as n from agendamentos where profissional_id = $1 and dia >= $2 and status in ('aguardando','aprovado','aguardando_pix')", [id, hoje()])).rows[0].n;
  if (abertos) return reply.code(409).send({ error: 'tem_agendamentos', n: abertos });
  await pool.query('update profissionais set ativo = false where id = $1', [id]);   // sai da equipe; o histórico continua
  mudou(); return estadoAdmin();
});

/* ============================ SAÚDE (relatório do servidor) ============================ */
app.get('/status', async (req, reply) => {
  if (!STATUS_KEY || !igual(String(req.headers['x-api-key'] || ''), STATUS_KEY)) return reply.code(401).send({ error: 'unauthorized' });
  const s = { ok: true, hora: new Date().toISOString(), pixTeste: PIX_TESTE, uptimeApiH: Math.round(process.uptime() / 360) / 10, memUsadaPct: Math.round((1 - os.freemem() / os.totalmem()) * 100) };
  try { const c = execSync('df -k /').toString().trim().split('\n').pop().split(/\s+/); s.discoUsadoPct = parseInt(c[4], 10); } catch (e) {}
  try {
    const r = (await pool.query("select (select count(*)::int from agendamentos) as agendamentos, (select count(*)::int from agendamentos where status = 'aguardando') as para_aprovar, (select count(*)::int from clientes where not exemplo) as clientes")).rows[0];
    Object.assign(s, r, { db: 'ok' });
  } catch (e) { s.db = 'erro'; s.ok = false; }
  return s;
});

app.listen({ port: PORT, host: '127.0.0.1' })   // só localhost: o Nginx faz o proxy e o SSL
  .then(() => console.log('API do salão na porta ' + PORT + (PIX_TESTE ? ' (Pix em MODO TESTE: sem dinheiro de verdade)' : '')))
  .catch(e => { console.error(e); process.exit(1); });
