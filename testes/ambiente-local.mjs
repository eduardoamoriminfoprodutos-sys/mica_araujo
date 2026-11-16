// Sobe o sistema inteiro NO MAC, para testar sem tocar na VPS: Postgres de teste, o servidor (api/server.js, Pix em modo teste)
// e o site (capa, cliente/, salao/, demo/) apontando para esse servidor. Nada vai para a internet.
// Uso:  FERRAMENTAS=<pasta com node_modules de embedded-postgres, fastify, pg e dotenv> node testes/ambiente-local.mjs
// Site: http://127.0.0.1:8090/   API: http://127.0.0.1:3920   Painel: login "dona", senha "senha-mock-teste-123"
// Aprovar um Pix de teste: POST http://127.0.0.1:3920/mp-teste/aprovar/<id do pagamento> com o cabeçalho x-teste-key: chave-mock-teste
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { spawn, execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = process.env.FERRAMENTAS; if (!F) { console.error('defina FERRAMENTAS'); process.exit(1); }
const { default: EmbeddedPostgres } = await import(pathToFileURL(F + '/node_modules/embedded-postgres/dist/index.js'));
const DADOS = path.join(F, 'pg-teste'), DB = 'postgres://postgres:teste@127.0.0.1:55440/salao_teste';
const log = (...a) => console.log('[ambiente]', ...a);
const bin = path.join(F, 'node_modules/@embedded-postgres', process.platform + '-' + process.arch, 'native/bin/pg_ctl');
try { execFileSync(bin, ['-D', DADOS, 'stop', '-m', 'fast'], { stdio: 'ignore' }); } catch (e) {}
fs.rmSync(DADOS, { recursive: true, force: true });
const pg = new EmbeddedPostgres({ databaseDir: DADOS, user: 'postgres', password: 'teste', port: 55440, persistent: false });
await pg.initialise(); await pg.start(); await pg.createDatabase('salao_teste');
const env = Object.assign({}, process.env, { NODE_PATH: F + '/node_modules', DATABASE_URL: DB, PORT: '3920', AUTH_SECRET: crypto.randomBytes(32).toString('hex'),
  MP_ACCESS_TOKEN: '', TESTE_KEY: 'chave-mock-teste', STATUS_KEY: 'status-mock-teste', PUBLIC_URL: '', ALLOWED_ORIGINS: 'http://127.0.0.1:8090' });
execFileSync('node', [RAIZ + '/api/semente.js'], { env, stdio: 'inherit' });
execFileSync('node', [RAIZ + '/api/criar-admin.js', 'dona', 'Dona de teste'], { env, input: 'senha-mock-teste-123\n', stdio: ['pipe', 'inherit', 'inherit'] });
const out = fs.openSync(path.join(F, 'api-teste.log'), 'w');
const srv = spawn('node', [RAIZ + '/api/server.js'], { env, stdio: ['ignore', out, out] });
srv.on('exit', c => log('server.js saiu', c));

const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const f = path.join(RAIZ, u);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || u.includes('/api/') || u.includes('/.git')) { res.writeHead(404); return res.end(); }
  let corpo = fs.readFileSync(f);
  if (u === '/marca.js') corpo = Buffer.from(String(corpo).replace(/api:\s*"[^"]*"/, 'api: "http://127.0.0.1:3920"'));   // aponta o site para o servidor de teste
  res.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(corpo);
}).listen(8090, '127.0.0.1');
log('site: http://127.0.0.1:8090/   api: http://127.0.0.1:3920   (Ctrl+C ou pkill -f ambiente-local.mjs para desligar)');
const parar = async () => { try { srv.kill(); await pg.stop(); } catch (e) {} process.exit(0); };
process.on('SIGTERM', parar); process.on('SIGINT', parar);
