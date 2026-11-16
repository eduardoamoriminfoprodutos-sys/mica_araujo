# Instruções para o Claude neste repositório

Leia o `README.md` primeiro. Resumo do que importa para trabalhar aqui:

## O que é

Sistema de agendamento para salões (app da cliente + painel do salão), hoje como **demonstração estática** publicada no GitHub Pages. Marca: **Studio Mica Araujo**. É o mesmo sistema do salão Favorita (repositório `eduardoamoriminfoprodutos-sys/favorita`): o código de `cliente/`, `salao/` e `comum/` é igual nos dois; só `marca.js` e `logo.png` mudam. O dono do projeto é o Eduardo (fala português, não é programador: explique em linguagem simples, sem jargão).

## Regras

- **HTML, CSS e JavaScript puro, sem build.** Não introduza framework, bundler nem dependência no app. Tem que continuar abrindo direto no GitHub Pages.
- **A marca mora só em `marca.js` + `logo.png`.** Nunca escreva o nome "Studio Mica Araujo", a cor ou o contato do salão dentro de `cliente/`, `salao/` ou `comum/`. Use `MARCA.nome`, `MARCA.nomeCompleto`, `MARCA.logo`, `MARCA.salao` e as variáveis de cor do CSS.
- **Cores só por variável** (`--gold`, `--ink`, `--bg` e as outras em `comum/estilos.css`). Componente novo usa as variáveis, nunca cor solta, para a troca de marca continuar funcionando.
- **Visual segue o redesign do Claude Design** (pasta `redesign-claude-design/` do repositório `favorita`), com a paleta do Studio em `marca.js`: cinza-pérola de fundo, grafite para seleção, rosé queimado para destaque, só Montserrat.
- **Dados de exemplo ficam marcados como exemplo** (selo "Exemplo"/"Ex.").
- **Depois de mudar o app, rode `testes/testar.js` e `testes/testar-abas.js`** (ver README) e só publique com tudo OK. Se mudar tela, refaça os prints com `prints/gerar-prints.js`.
- Dinheiro e preço, no sistema de verdade, são **calculados no servidor**, nunca no celular da cliente.
- Nada de senha, token ou chave do Mercado Pago no repositório.

## Tarefa atual

**Colocar no ar sincronizado pela VPS, em ambiente exclusivo do Studio Mica Araujo: siga `docs/ENTREGA-VPS.md`.**

## Como o app funciona por dentro

- `cliente/cliente.js` (app da cliente) e `salao/salao.js` (painel da dona) são separados; o que é comum está em `comum/nucleo.js`. Cada parte se registra no objeto `APP` (telas, abas, cliques, folhas). `comum/dados.js` é a única camada de dados.

- Estado único no objeto `S`; cada ação muda `S` e chama `render()`, que redesenha a tela inteira a partir de funções `vNomeDaTela()`.
- Cliques tratados num único `document.addEventListener("click")` pelos atributos `data-*` dos botões.
- `window.FAV_MODO` (definido em `cliente/`, `salao/` ou `demo/`) escolhe o que abre.
- Os dados da demonstração são salvos no `localStorage` (`salvar()` / `carregar()`), e o evento `storage` faz as abas da cliente e do salão conversarem. No sistema de verdade isso é trocado por chamadas ao servidor.
- Item da sacola é a string `"id"` ou `"id:opção"` (ex.: `"4:2"` = Selagem longo); use `it(k)` para ler nome, preço e duração.
