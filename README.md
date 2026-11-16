# Sistema de agendamento para salões · Studio Mica Araujo

> Mesmo sistema do salão Favorita (repositório `favorita`), com a marca do Studio: logo em monograma, grafite e rosé queimado sobre cinza-pérola. Para trazer melhorias do sistema base, copie `cliente/`, `salao/`, `comum/`, `demo/`, `api/` e `testes/` de lá; a marca fica só em `marca.js` e `logo.png`.

App da cliente + painel do salão, na marca **Studio Mica Araujo**. Hoje é uma **demonstração que roda só no navegador** (sem servidor): serve para apresentar à dona e validar o fluxo. O sistema também é usado em outros salões trocando só a marca.

> Serviços, preços, profissionais, clientes, lançamentos e o comprovante do Pix são **dados de exemplo**.

## Links (GitHub Pages)

Depois de ligar o GitHub Pages (ver abaixo):

| Página | Endereço |
|---|---|
| Capa da apresentação | `https://eduardoamoriminfoprodutos-sys.github.io/mica_araujo/` |
| App da cliente | `https://eduardoamoriminfoprodutos-sys.github.io/mica_araujo/cliente/` |
| Painel do salão | `https://eduardoamoriminfoprodutos-sys.github.io/mica_araujo/salao/` |
| Os dois na mesma tela | `https://eduardoamoriminfoprodutos-sys.github.io/mica_araujo/demo/` |

**Como apresentar em dois aparelhos (celular + computador):** use o link de apresentação do claude.ai (o protótipo publicado como artefato), entrando com a mesma conta nos dois: ali os dados ficam num banco compartilhado e as telas conversam ao vivo. No GitHub Pages, as telas só conversam **no mesmo aparelho**: abra o app da cliente e o painel do salão em duas abas do mesmo aparelho. O pedido feito no app aparece no painel na hora, e a resposta do salão aparece para a cliente. Os dados ficam guardados no próprio navegador; "Zerar demonstração", na capa, volta tudo ao início.

### Ligar o GitHub Pages

1. No repositório: **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**; em **Branch**, `main` e pasta `/ (root)`; **Save**.
3. Em 1 ou 2 minutos o endereço aparece no topo da mesma página.

**Atenção:** em conta gratuita do GitHub, o Pages só funciona com repositório **público**. Este repositório já é público.

## Como o código está organizado

| Arquivo | O que é |
|---|---|
| `marca.js` | **A marca do salão**: nome, logo, cores, WhatsApp e endereço. É o único arquivo que muda de um salão para outro (junto com o `logo.png`). |
| `logo.png` | Logo escura, fundo transparente (usada no app). `logo-clara.png` é a versão branca. |
| `cliente/` | **App da cliente**: `index.html` + `cliente.js` (catálogo e sacola, agendar, confirmar e pagar, Pix, meus horários, perfil). |
| `salao/` | **Painel do salão (dona)**: `index.html` + `salao.js` (pedidos, resumo com comprovante, agenda, financeiro e caixa, serviços e categorias, equipe). |
| `comum/nucleo.js` | O que os dois usam: datas e dinheiro, dados de exemplo, estado, regras de horário, ícones, componentes e o motor de tela. |
| `comum/dados.js` | **Única camada de dados.** Hoje grava no navegador; no sistema de verdade passa a falar com a API da VPS (ver `docs/ENTREGA-VPS.md`). |
| `comum/estilos.css` | Todo o visual (redesign do Claude Design). As cores são variáveis em `:root`. |
| `docs/FUTURO-ACESSO-COLABORADORAS.md` | **Proposta futura (não implementada):** login de cada profissional com limites (sem Financeiro, Equipe e cadastros), concluir os próprios atendimentos e "Minhas avaliações". Para a negociação. |
| `docs/ENTREGA-VPS.md` | **O que fazer para pôr no ar sincronizado pela VPS**: ambiente exclusivo do Studio, banco, rotas da API, Pix e sincronização. |
| `index.html` | Capa da apresentação. |
| `demo/` | Os dois apps juntos, com o botão "Ver como" (para apresentar). |
| `testes/testar.js` | 29 verificações de ponta a ponta na `demo/`. |
| `testes/testar-abas.js` | Verifica capa, app e painel em abas separadas conversando entre si. |
| `testes/testar-whatsapp.js` | Confere os atalhos de WhatsApp do salão no app da cliente. |
| `testes/testar-avaliacoes.js` | Avaliações: concluir atendimento, pop-up com "Agora não", nota no card, resumo, alerta, desempenho e PDI. |
| `testes/testar-dois-aparelhos.js` | Simula a apresentação em dois aparelhos (salão no celular, cliente no computador) pelo banco compartilhado do link do claude.ai. |
| `prints/` | Prints de todas as telas (`prints/gerar-prints.js` refaz). |
| `marca-original/` | Logo original enviada pelo Studio (referência). |

## Usar em outro salão

1. Copie este repositório para um novo (ex.: `salao-nome-da-marca`).
2. Troque o `logo.png` pela logo do salão (escura, fundo transparente, ~640 px de largura).
3. Em `marca.js`, troque `chave`, `nome`, `nomeCompleto`, `salao.fone`, `salao.mapa` e as `cores` (tirando da paleta da logo; o próprio arquivo traz um exemplo).
4. Troque os serviços, profissionais e categorias de exemplo no começo de `comum/nucleo.js` pelos do salão (no sistema de verdade eles vêm do banco).
5. Ligue o GitHub Pages do repositório novo.

## Rodar os testes

**Sistema com servidor (`cliente/` e `salao/`):** suba tudo no Mac com `FERRAMENTAS=<pasta com embedded-postgres, fastify, pg, dotenv e playwright> node testes/ambiente-local.mjs` (site em `http://127.0.0.1:8090/`, servidor de teste com Pix de mentira) e rode
`SALAO_LOGIN=dona SALAO_SENHA=senha-mock-teste-123 API=http://127.0.0.1:3920 TESTE_KEY=chave-mock-teste node testes/testar-abas.js http://127.0.0.1:8090/ pasta-para-prints`.
A `demo/` continua sem servidor (dados no navegador), para apresentar.


```bash
python3 -m http.server 8000          # na raiz do repositório
npx playwright install chromium      # uma vez
node testes/testar.js http://localhost:8000/demo/ caminho/para/uma-foto.jpg
node testes/testar-abas.js http://localhost:8000/ pasta-para-prints
node testes/testar-whatsapp.js http://127.0.0.1:8090/cliente/ pasta-para-prints   # com o ambiente-local.mjs ligado (o cliente/ fala com o servidor)
node testes/testar-avaliacoes.js http://localhost:8000/demo/ pasta-para-prints
node testes/testar-dois-aparelhos.js http://localhost:8000/demo/ pasta-para-prints
node prints/gerar-prints.js http://localhost:8000/demo/ caminho/para/uma-foto.jpg prints
```

## Regras do fluxo

- Pagamento: **Pix no app** (Mercado Pago, valor calculado no servidor pela sacola) ou **no salão** (cartão de crédito ou dinheiro).
- **Todo agendamento passa pela aprovação da dona.** Pix só chega para ela depois de pago; se reprovar, o Pix volta para a cliente.
- **Ao aprovar, o pedido vira um lançamento no Financeiro.** A dona fecha o caixa do dia por lá.
- A cliente tem perfil (foto, nome, WhatsApp, endereço) e pode deixar observação no agendamento.
- **Avaliação por profissional (estilo Google):** estrelas e número de avaliações no card de cada profissional; a cliente vê o resumo (média, barras de 5 a 1, comentários) e avalia depois que o atendimento é **concluído** no painel: ao abrir o app aparece o pop-up "Como foi seu atendimento com a Ana?" (não obrigatório, com "Agora não"; dá para avaliar depois em Meus horários). Só avalia quem foi atendida, uma vez por atendimento.
- **Gestão da equipe pelas avaliações:** na Equipe, alerta de atenção quando uma profissional recebe avaliações ruins recentes (2 ou mais notas de 1 a 2 estrelas em 30 dias, ou média recente abaixo de 3,5). No desempenho dela: nota dos últimos 30 dias comparada com antes, elogios e reclamações mais repetidos, comentários com filtro e o registro de ações de **PDI** (conversa, treinamento, acompanhamento, reconhecimento). A dona pode esconder do app um comentário ofensivo, mas a nota continua contando.
- **Falar com o salão no WhatsApp** (número em `marca.js`; **falta o número do Studio**: enquanto `salao.fone` estiver vazio, os botões ficam escondidos): card "Não encontrou o que procura?" no fim do catálogo, atalho no perfil e oferta de combinar/pedir encaixe quando não há serviço, profissional ou horário.
- A confirmar com a dona: cartão e dinheiro entram no Financeiro na aprovação ou só quando o atendimento for concluído.

## O que falta para virar sistema de verdade

Hoje tudo fica no navegador de quem abre. Para uso real: servidor com banco de dados (clientes, agendamentos, serviços, equipe, lançamentos), login da dona, Pix pelo Mercado Pago **na conta do salão** (criar cobrança, webhook, estorno), envio de avisos e hospedagem. O modelo de servidor que já funciona é o do DM Espetinho (mesma lógica de Pix e webhook).
