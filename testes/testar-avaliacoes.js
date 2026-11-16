// Testa as avaliações por profissional: nota no card, resumo estilo Google, avaliar depois do atendimento,
// e no painel da dona: alerta, desempenho, esconder comentário e registrar PDI.
// Uso: node testar-avaliacoes.js <URL da demo/> <pasta para prints>
const { chromium } = require('playwright');
(async () => {
  const [URL, OUT] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
  const toast = async () => (await p.textContent('#toast')).trim();
  const shot = n => p.screenshot({ path: `${OUT}/${n}.png` });

  // cliente: nota no card e resumo
  await p.click('[data-svc="1"]'); await p.click('#go-agendar');
  ok((await p.textContent('[data-pro="ana"]')).includes('★'), 'card da Ana mostra a nota');
  await p.click('[data-pro="ana"]'); await p.click('[data-veraval="ana"]');
  ok(!!(await p.$('.sheet .notabox')), 'abre o resumo de avaliações da Ana');
  ok((await p.$$('.sheet .rev')).length === 5, 'lista os 5 comentários da Ana');
  await shot('av-1-resumo-cliente');
  await p.click('button[data-sheetclose="1"]');
  // agenda, paga no salão, salão aprova, cliente avalia
  for (const d of await p.$$('.wd:not([disabled])')) { await d.click(); let f = await p.$$('.time:not([disabled])'); if (!f.length) { await p.click('[data-turno="tarde"]'); f = await p.$$('.time:not([disabled])'); } if (f.length) { await f[0].click(); break; } await p.click('[data-turno="manha"]'); }
  await p.click('#go-pagar'); await p.fill('#f-nome', 'Elika de Brito'); await p.fill('#f-fone', '(94) 99240-9089');
  await p.click('[data-pay="salao"]'); await p.click('#enviar');
  await p.click('#as-salao'); const id = await p.evaluate(() => S.bookings.find(b => b.mine).id); await p.click(`[data-apr="${id}"]`);
  await p.click('#as-cliente'); await p.click('[data-tab="meus"]');
  ok(!(await p.$(`[data-avaliar="${id}"]`)) && !(await p.$('.sheet')), 'confirmado ainda não pede avaliação (atendimento não aconteceu)');
  // a dona conclui o atendimento
  await p.click('#as-salao'); await p.click('[data-tab="agenda"]');
  const dia = await p.evaluate(i => S.bookings.find(b => b.id === i).day, id); await p.click(`[data-aday="${dia}"]`);
  ok(!!(await p.$(`[data-concluir="${id}"]`)), 'agenda tem "Concluir atendimento"');
  await p.click(`[data-concluir="${id}"]`); ok((await toast()).includes('convite para avaliar'), 'atendimento concluído');
  await shot('av-0-concluir');
  // cliente abre o app: pop-up de avaliação, não obrigatório
  await p.click('#as-cliente');
  ok(!!(await p.$('.sheet')) && (await p.textContent('.sheet')).includes('Seu último atendimento'), 'pop-up de avaliação aparece assim que a cliente volta ao app');
  ok((await p.textContent('.sheet button[data-sheetclose="1"]')).trim() === 'Agora não', 'pop-up tem "Agora não"');
  await shot('av-1b-popup');
  await p.click('.sheet button[data-sheetclose="1"]');
  await p.click('[data-tab="meus"]'); ok(!(await p.$('.sheet')), '"Agora não" não insiste de novo');
  ok(!!(await p.$(`[data-avaliar="${id}"]`)), 'ainda dá para avaliar por Meus horários');
  await p.click(`[data-avaliar="${id}"]`);
  ok(await p.$eval('#av-enviar', e => e.disabled), 'enviar fica bloqueado até escolher a nota');
  await p.click('[data-nota="2"]'); ok(!!(await p.$('[data-avtag="Atrasou"]')), 'nota baixa mostra etiquetas de reclamação');
  await p.click('[data-avtag="Atrasou"]'); await p.fill('#av-texto', 'Atrasou bastante.');
  await p.click('[data-nota="5"]'); ok(!!(await p.$('[data-avtag="Caprichosa"]')), 'nota alta troca para etiquetas de elogio');
  ok(await p.inputValue('#av-texto') === 'Atrasou bastante.', 'comentário não some ao trocar a nota');
  await p.click('[data-avtag="Caprichosa"]'); await p.fill('#av-texto', 'Ficou lindo, muito caprichosa!');
  await shot('av-2-avaliar');
  await p.click('#av-enviar'); ok((await toast()).includes('Obrigada'), 'avaliação enviada');
  ok(!(await p.$(`[data-avaliar="${id}"]`)) && !!(await p.$('.minhaav')), 'não deixa avaliar duas vezes e mostra a nota dada');
  const total = await p.evaluate(() => avalDe('ana').length); ok(total === 6, 'Ana passou a ter 6 avaliações');

  // salão: alerta e desempenho
  await p.click('#as-salao'); await p.click('[data-tab="equipe"]');
  ok((await p.textContent('#root')).includes('Atenção com Duda'), 'alerta de atenção para a Duda');
  await shot('av-3-equipe');
  await p.click('.alerta[data-proview="duda"]');
  const txt = (await p.textContent('#root')).replace(/\s+/g, ' ');
  ok(txt.includes('caiu de 5,0 para 2,0'), 'mostra que a nota da Duda caiu');
  ok(txt.includes('Atendimento apressado · 2'), 'conta as reclamações mais repetidas');
  await p.click('[data-avf="neg"]'); ok((await p.$$('.rev')).length === 4, 'filtro Negativas mostra 4');
  await shot('av-4-desempenho');
  const aid = await p.evaluate(() => avalDe('duda').find(a => a.nota === 1).id);
  await p.click(`[data-ocultar="${aid}"]`); ok((await toast()).includes('continua contando'), 'esconder comentário avisa que a nota conta');
  ok(await p.evaluate(() => nota1(media(avalDe('duda')))) === '3,0', 'nota pública continua com todas as avaliações');
  await p.click('[data-pditipo="Treinamento"]'); await p.fill('#pdi-texto', 'Treinamento de pontualidade e atendimento. Revisar em 30 dias.');
  await p.click('#pdi-salvar'); ok((await p.textContent('#root')).includes('Treinamento de pontualidade'), 'ação de PDI registrada');
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await shot('av-5-pdi');
  // cliente não vê o texto escondido
  await p.click('#as-cliente'); await p.click('[data-tab="catalogo"]'); await p.click('[data-svc="2"]'); await p.click('#go-agendar'); await p.click('[data-pro="duda"]'); await p.click('[data-veraval="duda"]');
  ok(!(await p.textContent('.sheet')).includes('Ficou no celular'), 'cliente não vê o comentário escondido');
  // persistência
  await p.reload(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => S.pdi.length === 1 && avalDe('ana').length === 6), 'avaliações e PDI continuam depois de recarregar');
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'sem rolagem lateral');
  console.log('erros:', errs);
  await b.close();
})();
