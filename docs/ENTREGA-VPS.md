# Entrega: colocar o sistema do Studio Mica Araujo no ar, sincronizado pela VPS

> **Situação (16/11/2026): ainda não está na VPS.** O servidor (`api/`) é o mesmo já em uso no salão Favorita (repositório `favorita`, pasta `/var/www/favorita`, porta 3020). Monte um ambiente **separado** para o Studio, seguindo a tabela abaixo, sem encostar no da Favorita. `marca.js` ainda **não tem `api`**: enquanto não tiver, `cliente/` e `salao/` funcionam como demonstração no navegador. Ao subir o servidor, acrescente `api: "https://api-mica.lecomigo.tech"`. Teste local completo: `testes/ambiente-local.mjs`.

Este documento é para o Claude do VS Code. Objetivo: transformar a demonstração (que hoje guarda tudo no navegador) em **sistema de verdade**, com **ambiente exclusivo do Studio na VPS do Eduardo**: pasta própria, banco próprio, processo próprio e endereço próprio, **igual ao DM Espetinho**, sem encostar nos outros sistemas.

## Contexto que já existe

- **VPS do Eduardo:** Hostinger KVM 2, IP `2.25.252.63`, acesso `ssh -i ~/.ssh/dm_vps root@2.25.252.63`. Já roda o **DM Espetinho** (API `https://api-dm.lecomigo.tech`, pm2 `dm-api`, porta 3001, Postgres, Nginx com SSL) e as pastas do **Lírio** e do **Lê Comigo**.
- **Modelo de servidor a copiar:** o backend do DM, no repositório `segundo-cerebro`, em `Sistemas e Apps/dm-vps-backend/` (`server.js`, `schema.sql`, `package.json`). É **Fastify + pg + dotenv**, com Pix do Mercado Pago (`/pix/criar`, `/pix/status/:mp_id`, `/pix/webhook`, função `confirmarPagamento`, idempotente) e variáveis `PORT`, `DATABASE_URL`, `AUTH_SECRET`, `API_KEY`, `MP_ACCESS_TOKEN`, `MP_API`, `PUBLIC_URL`, `ALLOWED_ORIGINS`.
- **Front-end (este repositório):** HTML/CSS/JS puro, sem build. `cliente/` (app da cliente), `salao/` (painel da dona), `comum/` (núcleo, estilos e **`comum/dados.js`, a única camada de dados**), `marca.js` (marca). Ver `README.md` e `CLAUDE.md`.

## Regras da VPS (não quebrar)

1. **Junte os comandos numa conexão SSH só.** Muitas conexões seguidas fazem a VPS recusar acesso por cerca de 1 hora.
2. **Não mexa no DM, no Lírio nem no Lê Comigo.** Nada de reiniciar Nginx sem `nginx -t` antes; nada de mexer nos bancos ou processos deles.
3. **Antes de mexer:** backup da configuração do Nginx e confira porta, disco e memória livres.
4. **Chave e senha só no `.env` da VPS** (permissão 600), nunca no repositório nem no front-end.
5. **Dinheiro e preço calculados no servidor**, nunca confiar no valor que vem do celular.
6. DM em horário de pico (almoço 11h–14h, janta 18h30–23h): evite reiniciar serviços compartilhados nesses horários.

## Ambiente exclusivo do Studio Mica Araujo

| Item | Valor sugerido |
|---|---|
| Pasta | `/var/www/mica-araujo/` com `api/` (servidor) e `site/` (cópia do front-end) |
| Banco | Postgres: banco **`mica`**, usuário **`mica`** com senha própria, dono só desse banco |
| Processo | pm2 **`mica-api`**, porta livre (ex.: **3021**; a 3010 é da Central e a 3020 da Favorita; confirme com `ss -ltnp`) |
| API | `https://api-mica.lecomigo.tech` (Nginx + certbot) |
| Site (opcional) | `https://mica.lecomigo.tech` servindo `site/`, ou continuar no GitHub Pages apontando para a API |
| `.env` | `PORT`, `DATABASE_URL`, `AUTH_SECRET`, `MP_ACCESS_TOKEN` (**da conta do salão**, vazio até a dona passar), `MP_API`, `PUBLIC_URL`, `ALLOWED_ORIGINS` (domínio do site e do GitHub Pages) |
| Backup | `pg_dump` diário do banco `mica` (cron), guardando 7 dias |

O DNS dos subdomínios (`api-mica` e `mica`) é criado no painel do domínio `lecomigo.tech`: **peça ao Eduardo** se não tiver acesso.

## Banco de dados (tabelas)

Partir do modelo de dados do app (`comum/nucleo.js`, objeto `S` e listas `SERVICES`, `PROS`, `CATS`):

- `categorias (id, nome, ordem)`
- `servicos (id, categoria_id, nome, descricao, duracao_min, preco_centavos, disponibilidade [disponivel|pausado|oculto|arquivado], foto_url, opcoes jsonb [{nome, preco_centavos, duracao_min}])`
- `profissionais (id, nome, foto_url, cor, categorias text[], descricao, inicio, fim, ativo)`
- `clientes (id, nome, whatsapp único, endereco, foto_url, criado_em)`
- `agendamentos (id, cliente_id, profissional_id, dia, inicio, fim, itens jsonb [{servico_id, opcao, nome, preco_centavos, duracao_min}], total_centavos, pagamento [pix|cartao|dinheiro], status [aguardando_pix|aguardando|aprovado|reprovado|concluido], motivo, observacao, mp_payment_id, pix_pago_em, estornado_em, criado_em)`
- `historico (id, agendamento_id, quando, quem, o_que)`
- `lancamentos (id, agendamento_id, forma, valor_centavos, dia, aprovado_em, recebido, caixa_id)`
- `caixas (id, dia único, total_pix, total_cartao, total_dinheiro, total, fechado_em)`
- `admins (id, nome, login, senha_hash)` para o login da dona
- `avaliacoes (id, agendamento_id único, profissional_id, cliente_id, nota 1-5, etiquetas text[], comentario, oculto bool, criado_em)`: só uma por agendamento, e só de agendamento **`concluido`** (concluído no painel pela dona ou, com o acesso por colaboradora, pela profissional do atendimento)
- `pdi (id, profissional_id, dia, tipo, texto, criado_em)`: ações de acompanhamento registradas pela dona

## API (rotas)

**Públicas (app da cliente):**
- `GET /catalogo`: categorias, serviços disponíveis/pausados e profissionais (sem dados internos).
- `GET /horarios?dia=&profissional=&itens=`: horários livres. **A regra é do servidor:** expediente da profissional menos agendamentos `aguardando`/`aprovado`, cabendo a duração total da sacola, domingo fechado. A mesma regra está hoje em `slotsFor()`/`slotsAny()` do `comum/nucleo.js`.
- `POST /clientes/entrar`: nome + WhatsApp → token da cliente (como o `exigirCliente` do DM).
- `PUT /clientes/eu` (perfil: nome, WhatsApp, endereço, foto).
- `POST /agendamentos`: itens, profissional (ou "qualquer"), dia, hora, pagamento, observação. O servidor **recalcula preço e duração** e confere se o horário ainda está livre. Pix → status `aguardando_pix`; no salão → `aguardando`.
- `POST /pix/criar` (agendamento) → QR e copia e cola do Mercado Pago, valor do servidor. `GET /pix/status/:id`. `POST /pix/webhook` → confirma, muda para `aguardando` (vai para a dona). **Copiar do DM**, incluindo a idempotência.
- `GET /meus-agendamentos` (da cliente logada).
- `GET /profissionais/:id/avaliacoes`: média, quantidade, distribuição e comentários **não escondidos** (a nota conta todas).
- `POST /agendamentos/:id/avaliacao` (cliente logada, dona do agendamento, depois do horário, uma vez).

**Painel (login da dona):**
- `POST /admin/entrar`.
- `GET /admin/pedidos?status=aguardando`, `GET /admin/agendamentos/:id` (com histórico e dados do pagamento para o comprovante: pagador, valor, data, ID da transação do Mercado Pago).
- `POST /admin/agendamentos/:id/concluir` → status `concluido` + histórico ("Concluiu o atendimento"); a cliente passa a ver o convite para avaliar.
- `POST /admin/agendamentos/:id/aprovar` → status `aprovado` + **cria lançamento**.
- `POST /admin/agendamentos/:id/reprovar` (motivo obrigatório) → se Pix pago, **estorno pela API do Mercado Pago** (`POST /v1/payments/:id/refunds`).
- `GET /admin/agenda?dia=&profissional=`.
- `GET /admin/financeiro?dia=`, `POST /admin/caixa/fechar?dia=`.
- `GET /admin/profissionais/:id/desempenho` (todas as avaliações, inclusive escondidas, médias de 30 dias e anterior, etiquetas mais frequentes, alerta), `POST /admin/avaliacoes/:id/ocultar`, `GET/POST /admin/profissionais/:id/pdi`.
- CRUD de `/admin/servicos`, `/admin/categorias`, `/admin/profissionais` (com upload de foto: guardar em `/var/www/mica-araujo/uploads/` servido pelo Nginx, ou no banco reduzido).

## Falta no servidor (o app já tem, só na demo)

Concluir atendimento, pop-up de avaliação, nota no card, desempenho, esconder comentário e PDI já existem no front-end, mas **só ligam na `demo/`**: com servidor, `salao.js` esconde o botão "Concluir" e o formulário de PDI (`DADOS.servidor`) e `dados.js` começa `S.avaliacoes` e `S.pdi` vazios. Para ligar: criar as rotas de concluir, avaliações e PDI listadas acima, carregar `S.avaliacoes`/`S.pdi` no `carregar()` e trocar essas condições por chamadas às rotas. Rodar `testes/testar-avaliacoes.js` adaptado contra o ambiente local.

## Próxima etapa (vender antes): acesso por colaboradora

Ver `docs/FUTURO-ACESSO-COLABORADORAS.md`. **Não implementar sem o OK do Eduardo**: ele apresenta na negociação. Se for implementado, o servidor barra por papel (dona x profissional), não só a tela.

## Sincronização

O app da cliente e o painel precisam se atualizar sozinhos (pedido novo aparece para a dona; resposta aparece para a cliente). Opções, da mais simples para a mais completa:
1. **Polling leve**: o painel pergunta a cada 10–15 s `GET /admin/pedidos?desde=<data>`; a cliente, nas telas Pix e Meus horários, a cada 10 s. É como o DM faz com o status do Pix.
2. **SSE** (`GET /eventos`, Server-Sent Events), quando quiser instantâneo.

## O que muda no front-end

- **Só `comum/dados.js`.** Hoje `salvar()` grava o estado inteiro no `localStorage` e `carregar()` lê. Trocar por:
  - `carregar()` → busca catálogo, agendamentos (da cliente ou da dona) e preenche `S`, `SERVICES`, `PROS`, `CATS`;
  - as ações que hoje mudam `S` direto (aprovar, reprovar, criar agendamento, salvar serviço etc., em `cliente/cliente.js` e `salao/salao.js`) passam a chamar a rota correspondente e, na resposta, atualizar `S` e chamar `render()`.
- Tirar a tela "Simular Pix pago" (`vPix` em `cliente/cliente.js`) e usar o status real do Pix.
- O endereço da API entra em `marca.js` (ex.: `api: "https://api-mica.lecomigo.tech"`), para cada salão ter o seu.
- Manter o visual e os testes (`testes/`). Ajustar os testes para rodarem contra uma API de teste.

## Ordem sugerida

1. Criar na VPS: pasta, banco, usuário do banco, `.env` e pm2 `mica-api` com um `GET /health`. Nginx + SSL em `api-mica.lecomigo.tech`.
2. Schema + rotas públicas e de admin, sem Pix (pagamento no salão), testando com `curl`.
3. Trocar `comum/dados.js` e as ações para usar a API. Publicar o site.
4. Pix com Mercado Pago **em modo teste** (simulador do DM: `MP_API` apontando para um simulador local); estorno.
5. Quando a dona passar a credencial do Mercado Pago dela: pôr no `.env`, testar um Pix real de valor baixo e estornar.
6. Backup diário do banco e um `GET /status` (como o do DM) para o relatório de saúde.

## Pendências com a dona (o Eduardo resolve)

- Serviços, preços, durações e profissionais reais (hoje são exemplo).
- Credencial do Mercado Pago **da conta do salão**.
- WhatsApp e endereço do Studio (para `marca.js`: botões de WhatsApp e "Como chegar").
- Cartão e dinheiro entram no Financeiro na aprovação (como está) ou só quando o atendimento for concluído?
