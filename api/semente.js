/* Prepara o banco do salão pela PRIMEIRA vez: tabelas + catálogo de exemplo (o mesmo da demonstração)
   + alguns pedidos e lançamentos marcados como EXEMPLO, para o painel não abrir vazio na apresentação.
   Uso (na pasta da API, com o .env):   node semente.js            -> cria as tabelas e, se o banco estiver vazio, o exemplo
                                         node semente.js --sem-exemplo   -> só as tabelas e o catálogo, sem pedidos de exemplo
   Não apaga nada: se já existir categoria cadastrada, não mexe no catálogo nem cria exemplo. */
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (e) {}
const fs = require('fs');
const { Pool } = require('pg');
const SEM_EXEMPLO = process.argv.includes('--sem-exemplo');
const TZ = 'America/Belem';

const CATS = ['Cabelo', 'Unhas', 'Sobrancelha e cílios', 'Estética'];
// [id, categoria, nome, descrição, minutos, preço (R$), opções [nome, preço, minutos]]
const SERVICOS = [
  [1, 'Cabelo', 'Corte feminino', 'Lavagem, corte e finalização', 60, 80], [2, 'Cabelo', 'Escova', 'Escova modelada com finalização', 45, 50],
  [3, 'Cabelo', 'Hidratação', 'Máscara de tratamento e escova', 60, 70],
  [4, 'Cabelo', 'Selagem', 'Redução de volume e frizz', 150, 220, [['curto', 180, 120], ['médio', 220, 150], ['longo', 280, 180]]],
  [5, 'Cabelo', 'Coloração', 'Tintura da raiz às pontas', 120, 180], [13, 'Cabelo', 'Corte', 'Só o corte, sem finalização', 30, 45],
  [6, 'Unhas', 'Manicure', 'Cutícula e esmaltação', 45, 30], [7, 'Unhas', 'Pedicure', 'Cutícula, lixa e esmaltação', 45, 35],
  [8, 'Unhas', 'Unha em gel', 'Alongamento com gel', 120, 150],
  [9, 'Sobrancelha e cílios', 'Design de sobrancelha', 'Medição, pinça e acabamento', 30, 40], [10, 'Sobrancelha e cílios', 'Design com henna', 'Design e henna para preencher', 45, 55],
  [11, 'Estética', 'Limpeza de pele', 'Extração, máscara e hidratação', 60, 110], [12, 'Estética', 'Maquiagem', 'Maquiagem para evento', 60, 120]
];
const EQUIPE = [
  ['ana', 'Ana', 'Corte, coloração e selagem', ['Cabelo'], '09:00', '18:00', '#C99A87'],
  ['bia', 'Bia', 'Manicure, pedicure e gel', ['Unhas'], '08:00', '17:00', '#A8909F'],
  ['carla', 'Carla', 'Sobrancelha e estética', ['Sobrancelha e cílios', 'Estética'], '09:00', '18:00', '#C9A86A'],
  ['duda', 'Duda', 'Cabelo e unhas', ['Cabelo', 'Unhas'], '10:00', '19:00', '#8FA58C']
];

function partes(d = new Date()) { const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).forEach(x => { p[x.type] = x.value; }); return p; }
const p = partes(), HOJE = p.year + '-' + p.month + '-' + p.day;
function addDias(k, n) { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const semana = k => new Date(k + 'T12:00:00Z').getUTCDay();
let D0 = HOJE; if (+p.hour >= 18) D0 = addDias(D0, 1); if (semana(D0) === 0) D0 = addDias(D0, 1);
let D1 = addDias(D0, 1); if (semana(D1) === 0) D1 = addDias(D1, 1);

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query(fs.readFileSync(__dirname + '/schema.sql', 'utf8'));
    console.log('tabelas ok');
    if ((await c.query('select count(*)::int as n from categorias')).rows[0].n) { console.log('o banco já tem catálogo: nada mais a fazer'); return; }
    await c.query('begin');
    const catId = {};
    for (let i = 0; i < CATS.length; i++) catId[CATS[i]] = (await c.query('insert into categorias (nome, ordem) values ($1, $2) returning id', [CATS[i], i + 1])).rows[0].id;
    for (let i = 0; i < SERVICOS.length; i++) {
      const [id, cat, nome, desc, min, preco, ops] = SERVICOS[i];
      await c.query('insert into servicos (id, categoria_id, nome, descricao, duracao_min, preco_centavos, opcoes, ordem) values ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, catId[cat], nome, desc, min, preco * 100, JSON.stringify((ops || []).map(o => ({ nome: o[0], preco_centavos: o[1] * 100, duracao_min: o[2] }))), i + 1]);
    }
    await c.query("select setval('servicos_id_seq', (select max(id) from servicos))");
    for (let i = 0; i < EQUIPE.length; i++) {
      const [id, nome, faz, cats, ini, fim, cor] = EQUIPE[i];
      await c.query('insert into profissionais (id, nome, descricao, categorias, inicio, fim, cor, ordem) values ($1,$2,$3,$4,$5,$6,$7,$8)', [id, nome, faz, cats.map(x => catId[x]), ini, fim, cor, i + 1]);
    }
    console.log('catálogo de exemplo:', CATS.length, 'categorias,', SERVICOS.length, 'serviços,', EQUIPE.length, 'profissionais');
    if (!SEM_EXEMPLO) {
      const item = (k) => { const [sid, oi] = String(k).split(':'), s = SERVICOS.find(x => x[0] === +sid), op = oi != null ? s[6][+oi] : null;
        return { chave: String(k), servico_id: s[0], categoria_id: catId[s[1]], opcao: op ? +oi : null, nome: op ? s[2] + ' (' + op[0] + ')' : s[2], preco_centavos: (op ? op[1] : s[5]) * 100, duracao_min: op ? op[2] : s[4] }; };
      const cli = async (nome, w, end) => (await c.query('insert into clientes (nome, whatsapp, endereco, exemplo) values ($1,$2,$3,true) returning id', [nome, w, end])).rows[0].id;
      const ag = async (cid, chaves, pro, dia, ini, pag, status, obs, hist, pixPago) => {
        const its = chaves.map(item), dur = its.reduce((a, i) => a + i.duracao_min, 0), tot = its.reduce((a, i) => a + i.preco_centavos, 0);
        const t = +ini.slice(0, 2) * 60 + +ini.slice(3) + dur, fim = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
        const id = (await c.query(`insert into agendamentos (cliente_id, profissional_id, dia, inicio, fim, itens, total_centavos, pagamento, status, observacao, pix_pago_em, pix_valor_centavos, pix_pagador, mp_payment_id, pix_teste, exemplo)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true) returning id`,
          [cid, pro, dia, ini, fim, JSON.stringify(its), tot, pag, status, obs, pixPago ? new Date() : null, pixPago ? tot : null, pixPago ? 'Cliente de exemplo' : null, pixPago ? '7000000001' : null, !!pixPago])).rows[0].id;
        for (const [quem, o] of hist) await c.query('insert into historico (agendamento_id, quem, o_que) values ($1,$2,$3)', [id, quem, o]);
        return id;
      };
      const mariana = await cli('Mariana Costa', '94900000001', 'Rua das Flores, 210, Centro');
      const juliana = await cli('Juliana Alves', '94900000002', 'Av. Brasil, 88, Jardim Paraíso');
      const renata = await cli('Renata Lima', '94900000003', 'Rua Bahia, 122, Novo Horizonte');
      const paula = await cli('Paula Reis', '94900000004', '');
      await ag(mariana, ['4:1'], 'ana', D0, '10:00', 'pix', 'aguardando', 'Cabelo muito seco e fino nas pontas. Quero tirar o volume sem perder o movimento.', [['Cliente', 'Pedido criado'], ['Sistema', 'Pix confirmado (exemplo)']], true);
      await ag(juliana, ['9', '10'], 'carla', D1, '14:00', 'dinheiro', 'aguardando', '', [['Cliente', 'Pedido criado']]);
      await ag(renata, ['9'], 'carla', D0, '14:00', 'cartao', 'aprovado', '', [['Cliente', 'Pedido criado'], ['Dona', 'Aprovou o agendamento']]);
      await ag(paula, ['1'], 'duda', D0, '15:00', 'dinheiro', 'aprovado', 'Só pontas.', [['Cliente', 'Pedido criado'], ['Dona', 'Aprovou o agendamento']]);
      for (const [forma, v, nome, its] of [['cartao', 80, 'Paula Reis', ['1']], ['dinheiro', 65, 'Juliana Alves', ['9', '10']], ['cartao', 45, 'Renata Lima', ['9']], ['dinheiro', 25, 'Carol Mendes', ['6']]])
        await c.query('insert into lancamentos (forma, valor_centavos, dia, nome, itens, exemplo) values ($1,$2,$3,$4,$5,true)', [forma, v * 100, HOJE, nome, JSON.stringify(its.map(k => ({ chave: k })))]);
      console.log('exemplos: 4 pedidos (2 para aprovar, 2 confirmados) e 4 lançamentos de hoje, todos marcados como exemplo');
    }
    await c.query('commit');
  } catch (e) { try { await c.query('rollback'); } catch (x) {} console.error('ERRO, nada gravado:', e.message); process.exitCode = 1; }
  finally { c.release(); await pool.end(); }
})();
