// Confere os atalhos de WhatsApp do salão no app da cliente. Uso: node testar-whatsapp.js <URL do cliente/> <pasta para prints>
const { chromium } = require('playwright');
(async () => {
  const [URL, OUT] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
  const fone = await p.evaluate(() => MARCA.salao.fone);
  const links = async () => p.$$eval('a.wa-btn', as => as.map(a => decodeURIComponent(a.href)));

  let l = await links();
  ok(l.length >= 1 && l[0].startsWith('https://wa.me/55' + fone), 'catálogo tem o WhatsApp do salão: ' + (l[0] || ''));
  ok(l[0] && l[0].includes('serviço que não encontrei'), 'mensagem pronta no catálogo');
  await p.$eval('.wa-card', el => el.scrollIntoView({ block: 'center' })); await p.screenshot({ path: OUT + '/wa-catalogo.png' });
  ok(await p.$eval('.wa-card a', a => a.target === '_blank'), 'abre fora do app');

  // categoria vazia: arquiva tudo de Estética pela própria memória do app e confere o aviso
  await p.evaluate(() => { SERVICES.filter(s => s.cat === 'Estética').forEach(s => s.disp = 'oculto'); render(); });
  await p.click('[data-cat="Estética"]');
  l = await links(); ok(l.some(x => x.includes('serviços de estética')), 'categoria vazia oferece perguntar ao salão');

  // sem profissional para tudo junto: Manicure + Limpeza de pele (ninguém faz as duas)
  await p.evaluate(() => { SERVICES.forEach(s => { if (s.cat === 'Estética') s.disp = 'disponivel'; }); S.cart = ['6', '11']; S.view = 'agendar'; render(); });
  l = await links(); ok(l.some(x => x.includes('juntos')), 'sem profissional para tudo junto oferece combinar no WhatsApp');

  // perfil
  await p.evaluate(() => { S.cart = []; S.view = 'perfil'; render(); });
  l = await links(); ok(l.some(x => x.includes('tenho uma dúvida')), 'perfil tem Falar com o salão');
  await p.$eval('.wa-card', el => el.scrollIntoView({ block: 'center' })); await p.screenshot({ path: OUT + '/wa-perfil.png' });
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'sem rolagem lateral');
  console.log('erros:', errs);
  await b.close();
})();
