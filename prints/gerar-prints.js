// Print de todas as telas (celular 390x844, 2x). Uso: node gerar-prints.js <URL da demo/> <foto.jpg> <pasta de saída>
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [URL, FOTO, OUT] = process.argv.slice(2);
  fs.mkdirSync(OUT + '/cliente', { recursive: true }); fs.mkdirSync(OUT + '/salao', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);   // começa do zero
  const list = [];
  const shot = async (dir, name, desc) => {
    await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.hidden = true; }); await p.waitForTimeout(250);
    await p.screenshot({ path: `${OUT}/${dir}/${name}.png` });
    await p.screenshot({ path: `${OUT}/${dir}/${name}-pagina-inteira.png`, fullPage: true });
    list.push([dir, name, desc]);
  };
  const top = () => p.evaluate(() => window.scrollTo(0, 0));
  const pickTime = async () => {
    for (const d of await p.$$('.wd:not([disabled])')) {
      await d.click();
      for (const t of ['manha', 'tarde']) { await p.click(`[data-turno="${t}"]`); const f = await p.$$('.time:not([disabled])'); if (f.length > 1) { await f[1].click(); return; } if (f.length) { await f[0].click(); return; } }
    }
  };
  // perfil primeiro, para o catálogo mostrar a saudação e a foto
  await p.click('[data-tab="perfil"]'); await shot('cliente', '01-perfil-vazio', 'Perfil sem dados');
  await p.fill('#p-nome', 'Elika de Brito'); await p.fill('#p-fone', '(94) 99240-9089'); await p.fill('#p-end', 'Rua Bahia, 122, Novo Horizonte');
  await p.setInputFiles('#foto-input', FOTO); await p.waitForTimeout(500); await p.click('#salvar-perfil'); await top();
  await shot('cliente', '02-perfil-com-foto', 'Perfil com foto e dados');
  await p.click('[data-tab="catalogo"]'); await top(); await shot('cliente', '03-catalogo', 'Catálogo: saudação, categorias, serviços');
  await p.click('[data-svc="4"]'); await shot('cliente', '04-escolher-opcao', 'Folha para escolher a opção (Selagem curto/médio/longo)');
  await p.click('[data-addopt="4:1"]'); await p.click('[data-svc="2"]'); await top();
  await shot('cliente', '05-sacola-flutuante', 'Sacola flutuante dourada com 2 serviços');
  await p.click('[data-cat="Unhas"]'); await top(); await shot('cliente', '06-catalogo-unhas', 'Catálogo, categoria Unhas');
  await p.click('[data-cat="Cabelo"]');
  await p.click('#go-agendar'); await top(); await shot('cliente', '07-agendar', 'Agendar: stepper, sacola, profissional, dia, horário');
  await p.click('[data-pro="ana"]'); await pickTime(); await shot('cliente', '08-agendar-escolhido', 'Agendar com Ana, dia e horário escolhidos');
  await p.click('#go-pagar'); await top(); await shot('cliente', '09-confirmar-pix', 'Confirmar: resumo, pagamento Pix, observação');
  await p.click('[data-pay="salao"]'); await p.fill('#f-obs', 'Quero fazer selagem, meu cabelo é muito seco e fino.');
  await p.evaluate(() => window.scrollTo(0, 400)); await shot('cliente', '10-confirmar-no-salao', 'Confirmar: no salão, cartão ou dinheiro');
  await p.click('[data-pay="pix"]'); await p.click('#enviar'); await top(); await shot('cliente', '11-pix', 'Pix: valor, QR, copia e cola');
  await p.click('#simular-pix'); await top(); await shot('cliente', '12-meus-horarios-aguardando', 'Meus horários: aguardando salão');
  // segundo pedido, no salão
  await p.click('[data-tab="catalogo"]'); await p.click('[data-cat="Unhas"]'); await p.click('[data-svc="6"]'); await p.click('#go-agendar'); await pickTime(); await p.click('#go-pagar');
  await p.click('[data-pay="salao"]'); await p.click('[data-payin="dinheiro"]'); await p.click('#enviar');

  await p.click('#as-salao'); await top(); await shot('salao', '01-pedidos', 'Pedidos: números do dia e pedidos para aprovar');
  const ids = await p.evaluate(() => S.bookings.filter(b => b.mine).map(b => b.id));
  await p.click(`[data-open="${ids[0]}"]`); await top(); await shot('salao', '02-resumo-do-pedido', 'Resumo do pedido: cliente, serviço, observação, pagamento, comprovante, mensagens, histórico');
  await p.click(`[data-zoom="${ids[0]}"]`); await p.click('[data-z="1"]'); await shot('salao', '03-comprovante-zoom', 'Comprovante do Pix com zoom'); await p.click('[data-zclose="1"]');
  await p.click(`[data-rej="${ids[0]}"]`); await shot('salao', '04-reprovar-motivo', 'Reprovar: folha com motivos'); await p.click('button[data-sheetclose="1"]');
  await p.click(`[data-apr="${ids[0]}"]`); await top(); await shot('salao', '05-pedido-aprovado', 'Pedido aprovado');
  await p.click('[data-fechar="1"]'); await p.click(`[data-rej="${ids[1]}"]`); await p.click('[data-motivo="Horário indisponível"]');
  await p.click('[data-tab="agenda"]'); await top(); await shot('salao', '06-agenda', 'Agenda: dias, números, filtro por profissional, linha do tempo');
  await p.click('[data-tab="financeiro"]'); await top(); await shot('salao', '07-financeiro', 'Financeiro: faturamento do dia, formas, lançamentos');
  await p.click('#fechar-caixa'); await shot('salao', '08-fechar-caixa', 'Fechar caixa: resumo por forma'); await p.click('#caixa-ok'); await top();
  await shot('salao', '09-caixa-fechado', 'Caixa fechado');
  await p.click('[data-tab="servicos"]'); await top(); await shot('salao', '10-servicos', 'Serviços por categoria');
  await p.click('[data-svcedit="4"]'); await top(); await shot('salao', '11-editar-servico', 'Editar serviço com opções'); await p.click('[data-svcfechar="1"]');
  await p.click('#abrir-cats'); await top(); await shot('salao', '12-categorias', 'Categorias'); await p.click('[data-catsfechar="1"]');
  await p.click('[data-tab="equipe"]'); await top(); await shot('salao', '13-equipe', 'Equipe');
  await p.click('[data-proview="ana"]'); await p.click('[data-proedit="ana"]'); await top(); await shot('salao', '14-editar-profissional', 'Editar profissional: foto, especialidades, horário, cor na agenda'); await p.click('[data-profechar="1"]');

  await p.click('#as-cliente'); await p.click('[data-tab="meus"]'); await top(); await shot('cliente', '13-meus-horarios-respostas', 'Meus horários: confirmado e não aprovado');
  fs.writeFileSync(OUT + '/lista.json', JSON.stringify(list, null, 1));
  console.log('prints:', list.length, 'erros:', errs);
  await b.close();
})();
