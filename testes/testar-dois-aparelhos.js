// Simula a apresentação em dois aparelhos (celular com o salão, computador com a cliente) ligados pelo banco
// compartilhado do link do claude.ai. Aqui o banco é imitado no próprio teste.
// Uso: node testar-dois-aparelhos.js <URL da demo/> <pasta para prints>
const { chromium } = require('playwright');
(async () => {
  const [URL, OUT] = process.argv.slice(2);
  const b = await chromium.launch();
  let doc = null; const paginas = [];
  const empurrar = async () => { for (const p of paginas) await p.evaluate(d => window.__snap && window.__snap(d), doc).catch(() => {}); };
  const abrir = async (nome, tela) => {
    const ctx = await b.newContext({ viewport: tela, deviceScaleFactor: 2 });   // aparelhos separados: nada em comum além do banco
    const p = await ctx.newPage(); p.nome = nome; p.erros = [];
    p.on('pageerror', e => p.erros.push(e.message));
    await p.exposeBinding('__set', async (_, d) => { doc = d; await empurrar(); });
    await p.exposeBinding('__del', async () => { doc = null; await empurrar(); });
    await p.exposeBinding('__sub', async () => { await empurrar(); });
    await p.addInitScript(() => {
      window.__snap = null;
      const ref = {
        set: d => window.__set(JSON.stringify(d)), delete: () => window.__del(),
        onSnapshot(next) { window.__snap = d => next(d ? { exists: true, data: () => JSON.parse(d) } : { exists: false, data: () => undefined }); window.__sub(); return () => {}; }
      };
      window.claude = { use: async n => n === 'db' ? { doc: () => ref } : null };
    });
    await p.goto(URL); await p.waitForTimeout(1500); paginas.push(p); return p;
  };
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
  const espera = ms => new Promise(r => setTimeout(r, ms));

  const celular = await abrir('celular', { width: 390, height: 844 });
  const pc = await abrir('computador', { width: 1280, height: 860 });
  await celular.click('#as-salao');
  // cliente agenda no computador
  await pc.click('[data-cat="Unhas"]'); await pc.click('[data-svc="6"]'); await pc.click('#go-agendar'); await pc.click('[data-pro="bia"]');
  for (const d of await pc.$$('.wd:not([disabled])')) { await d.click(); let f = await pc.$$('.time:not([disabled])'); if (!f.length) { await pc.click('[data-turno="tarde"]'); f = await pc.$$('.time:not([disabled])'); } if (f.length) { await f[0].click(); break; } await pc.click('[data-turno="manha"]'); }
  await pc.click('#go-pagar'); await pc.fill('#f-nome', 'Isadora Lima'); await pc.fill('#f-fone', '(94) 98888-7777');
  await pc.click('[data-pay="salao"]'); await pc.click('#enviar'); await espera(1200);
  const id = await celular.evaluate(() => (S.bookings.find(b => b.nome === 'Isadora Lima') || {}).id);
  ok(!!id, 'pedido feito no computador chegou no celular (salão)');
  await celular.click(`[data-apr="${id}"]`); await espera(1200);
  ok((await pc.textContent('#root')).includes('Confirmado'), 'aprovação no celular aparece no computador');
  // conclui no celular
  await celular.click('[data-tab="agenda"]'); const dia = await celular.evaluate(i => S.bookings.find(b => b.id === i).day, id);
  await celular.click(`[data-aday="${dia}"]`); await celular.click(`[data-concluir="${id}"]`); await espera(1200);
  await celular.screenshot({ path: OUT + '/dois-1-celular-concluiu.png' });
  ok(!!(await pc.$('.sheet')) && (await pc.textContent('.sheet')).includes('Como foi com Bia'), 'pop-up de avaliação aparece no computador');
  await pc.screenshot({ path: OUT + '/dois-2-computador-popup.png' });
  await pc.click('[data-nota="5"]'); await pc.click('[data-avtag="Caprichosa"]'); await pc.fill('#av-texto', 'Unhas perfeitas!'); await pc.click('#av-enviar'); await espera(1200);
  await celular.click('[data-tab="equipe"]'); await celular.click('[data-proview="bia"]');
  ok((await celular.textContent('#root')).includes('Unhas perfeitas!'), 'avaliação do computador aparece no desempenho da Bia no celular');
  await celular.screenshot({ path: OUT + '/dois-3-celular-avaliacao.png', fullPage: true });
  // zerar volta tudo ao início nos dois
  await pc.click('#zerar-demo'); await espera(2500);
  ok(await celular.evaluate(() => !S.bookings.some(b => b.nome === 'Isadora Lima')), 'zerar no computador volta o celular ao início');
  ok(!!doc && !JSON.parse(JSON.parse(doc).json).bookings.some(b => b.nome === 'Isadora Lima'), 'banco compartilhado sem os dados antigos');
  for (const p of paginas) console.log(p.nome, 'erros:', p.erros);
  await b.close();
})();
