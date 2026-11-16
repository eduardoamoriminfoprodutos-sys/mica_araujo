/* Cria (ou troca a senha de) quem entra no painel do salão.
   Uso (na pasta da API, com o .env):   echo "SENHA" | node criar-admin.js <login> "<Nome>"
   A senha vem pela entrada padrão (não fica no histórico do terminal nem em arquivo). Mínimo de 8 caracteres. */
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (e) {}
const crypto = require('crypto');
const { Pool } = require('pg');
const [login, nome] = process.argv.slice(2);
if (!/^[a-z0-9._-]{3,40}$/.test(login || '') || !nome) { console.error('uso: echo "SENHA" | node criar-admin.js <login> "<Nome>"   (login: letras minúsculas, números, ponto, traço)'); process.exit(1); }
let senha = ''; process.stdin.on('data', d => { senha += d; }).on('end', async () => {
  senha = senha.replace(/\r?\n$/, '');
  if (senha.length < 8) { console.error('senha curta: use pelo menos 8 caracteres'); process.exit(1); }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await new Promise((ok, f) => crypto.scrypt(senha, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? f(e) : ok(k.toString('hex'))));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(`insert into admins (nome, login, salt, senha_hash) values ($1,$2,$3,$4)
    on conflict (login) do update set nome = $1, salt = $3, senha_hash = $4, ativo = true, atualizado_em = now() returning (xmax = 0) as novo`, [nome, login, salt, hash]);
  await pool.query('delete from admin_sessoes where admin_id = (select id from admins where login = $1)', [login]);
  console.log(r.rows[0].novo ? 'acesso criado: ' + login : 'senha trocada: ' + login + ' (as sessões abertas foram encerradas)');
  await pool.end();
});
