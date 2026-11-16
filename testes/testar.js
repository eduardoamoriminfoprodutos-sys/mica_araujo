// Teste de ponta a ponta da página demo/ (cliente + salão). Uso: node testar.js <URL da demo/> <foto.jpg>
const { chromium } = require('playwright');
(async () => {
  const [URL, FOTO] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(URL); await p.waitForTimeout(1200);
  const toast = async () => (await p.textContent('#toast')).trim();
  const ok = (cond, msg) => console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg);

  // catálogo + sacola + opção pela folha
  await p.click('[data-svc="4"]'); ok(!!(await p.$('.sheet')), 'Selagem abre a folha de opções');
  await p.click('[data-addopt="4:1"]'); await p.click('[data-svc="2"]');
  const fl = (await p.textContent('.float')).replace(/\s+/g, ' ');
  ok(fl.includes('2 serviços') && fl.includes('3h15') && fl.includes('270,00'), 'sacola flutuante: ' + fl);
  ok((await p.textContent('[data-svc="4"]')).includes('médio'), 'opção aparece como etiqueta no card');
  // agendar
  await p.click('#go-agendar');
  ok((await p.$$('.pcard')).length >= 3, 'cards de profissional');
  await p.click('[data-pro="ana"]');
  const dias = await p.$$('.wd:not([disabled])');
  let achou = false;
  for (const d of dias) { await d.click(); for (const turno of ['manha', 'tarde']) { await p.click(`[data-turno="${turno}"]`); const f = await p.$$('.time:not([disabled])'); if (f.length) { await f[0].click(); achou = true; break; } } if (achou) break; }
  ok(achou, 'achou horário livre');
  ok(!(await p.$eval('#go-pagar', e => e.disabled)), 'Continuar habilitado');
  await p.click('[data-wk="1"]'); ok(true, 'navega para a próxima semana'); await p.click('[data-wk="-1"]');
  if (!(await p.$('.time[aria-pressed="true"]'))) { const f = await p.$$('.time:not([disabled])'); if (f.length) await f[0].click(); else { await p.click('[data-turno="tarde"]'); const g = await p.$$('.time:not([disabled])'); await g[0].click(); } }
  await p.click('#go-pagar');
  // confirmar sem perfil: digitar, trocar pagamento, conferir que não some
  await p.fill('#f-nome', 'Elika de Brito'); await p.fill('#f-fone', '(94) 99240-9089'); await p.fill('#f-obs', 'Cabelo muito seco e fino.');
  await p.click('[data-pay="salao"]'); ok(await p.inputValue('#f-nome') === 'Elika de Brito', 'nome não some ao trocar pagamento');
  await p.click('[data-payin="dinheiro"]'); await p.click('[data-pay="pix"]');
  ok((await p.textContent('#enviar')).includes('Pagar R$ 270,00 com Pix'), 'CTA do Pix com valor');
  await p.click('#enviar'); ok(!!(await p.$('#simular-pix')), 'abre a tela do Pix');
  await p.click('#simular-pix'); ok((await p.textContent('#root')).includes('Aguardando salão'), 'Meus horários: aguardando salão');
  // perfil com foto
  await p.click('[data-tab="perfil"]'); await p.setInputFiles('#foto-input', FOTO); await p.waitForTimeout(400);
  ok(await p.inputValue('#p-nome') === 'Elika de Brito', 'perfil mantém nome após foto');
  // segundo pedido pago no salão
  await p.click('[data-tab="catalogo"]'); await p.click('[data-cat="Unhas"]'); await p.click('[data-svc="6"]'); await p.click('#go-agendar');
  for (const d of await p.$$('.wd:not([disabled])')) { await d.click(); const f = await p.$$('.time:not([disabled])'); if (f.length) { await f[0].click(); break; } await p.click('[data-turno="tarde"]'); const g = await p.$$('.time:not([disabled])'); if (g.length) { await g[0].click(); break; } await p.click('[data-turno="manha"]'); }
  await p.click('#go-pagar'); ok(!(await p.$('#f-nome')), 'com perfil não pede nome de novo');
  await p.click('[data-pay="salao"]'); await p.click('[data-payin="cartao"]'); await p.click('#enviar');

  // salão
  await p.click('#as-salao');
  const ids = await p.evaluate(() => S.bookings.filter(b => b.mine).map(b => b.id));
  const lancAntes = await p.evaluate(() => S.lanc.length);
  await p.click(`[data-apr="${ids[0]}"]`); ok((await toast()).includes('Financeiro'), 'aprovar avisa Financeiro');
  ok(await p.evaluate(() => S.lanc.length) === lancAntes + 1, 'aprovar cria lançamento');
  await p.click(`[data-rej="${ids[1]}"]`); ok(!!(await p.$('.sheet')), 'reprovar abre folha de motivos');
  await p.click('[data-motivo="Horário indisponível"]');
  await p.click('[data-open="1"]'); ok(!!(await p.$('[data-zoom="1"]')), 'resumo do pedido com comprovante');
  await p.click('[data-zoom="1"]'); await p.click('[data-z="1"]'); ok(!!(await p.$('.lightbox')), 'zoom do comprovante'); await p.click('[data-zclose="1"]');
  await p.click('[data-rej="1"]'); await p.click('[data-motivo="Profissional ausente"]');
  ok((await p.textContent('.status-box')).includes('Pix devolvido'), 'reprovar Pix devolve');
  await p.click('[data-fechar="1"]');
  // agenda
  await p.click('[data-tab="agenda"]'); ok((await p.$$('.gmini div')).length === 3, 'agenda com 3 números');
  await p.click('[data-apro="carla"]'); await p.click('[data-apro="todas"]');
  // financeiro
  await p.click('[data-tab="financeiro"]');
  const big = await p.textContent('.fin .big'); ok(/R\$/.test(big), 'financeiro total ' + big);
  await p.click('[data-finf="pix"]'); await p.click('[data-finf="todos"]');
  await p.click('#fechar-caixa'); await p.click('#caixa-ok'); ok((await p.textContent('#root')).includes('Caixa fechado'), 'fecha o caixa');
  // serviços, categorias, equipe
  await p.click('[data-tab="servicos"]'); await p.click('[data-svcedit="novo"]');
  await p.fill('#e-nome', 'Depilação de buço'); await p.fill('#e-preco', '25'); await p.selectOption('#e-cat', 'Estética'); await p.click('#svc-salvar');
  ok((await toast()).includes('publicado'), 'novo serviço');
  await p.click('[data-tog="6"]'); await p.click('#abrir-cats'); await p.fill('#cat-nova', 'Depilação'); await p.click('#cat-add'); ok((await toast()).includes('criada'), 'categoria criada');
  await p.click('[data-catsfechar="1"]'); await p.click('[data-tab="equipe"]'); await p.click('[data-proedit="novo"]');
  await p.fill('#d-nome', 'Larissa'); await p.click('[data-dcat="Unhas"]'); await p.click('[data-cor="#8E9DB0"]'); await p.click('#pro-salvar'); ok((await toast()).includes('entrou'), 'nova profissional');
  await p.click('[data-proview="ana"]'); await p.click('[data-proedit="ana"]'); await p.click('[data-delask="1"]'); ok(!(await p.$('#pro-excluir')), 'bloqueia excluir quem tem agenda');
  // cliente vê respostas
  await p.click('#as-cliente'); await p.click('[data-tab="meus"]');
  const meus = (await p.textContent('#root')).replace(/\s+/g, ' ');
  ok(meus.includes('Confirmado') && meus.includes('Não aprovado'), 'cliente vê confirmado e não aprovado');
  ok(!!(await p.$('.acts a')), 'confirmado tem Como chegar / WhatsApp');
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'sem rolagem lateral');
  console.log('erros:', errs);
  await b.close();
})();
