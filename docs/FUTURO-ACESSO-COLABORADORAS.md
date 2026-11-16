---
versao: 1
atualizado_em: 2026-11-16
status: proposta futura (não implementado)
---
# Acesso por colaboradora (proposta para a entrega)

> **Ainda não está no sistema.** É a próxima etapa, para apresentar na negociação e implementar quando a cliente fechar. O que já funciona hoje está no fim desta nota.

## A ideia em uma frase

Cada profissional do salão entra no painel com o **próprio login** e vê só o que precisa para trabalhar. A dona continua com o acesso completo e passa a ter os **atendimentos concluídos e as avaliações ligados a cada profissional**.

## O que cada uma vê

| Área do painel | Dona | Profissional |
|---|---|---|
| Pedidos (aprovar e reprovar) | ✅ | ✅ |
| Agenda do dia | ✅ todas | ✅ (pode filtrar a dela) |
| **Concluir atendimento** | ✅ qualquer um | ✅ **só os dela** |
| Serviços: consultar preço e tempo | ✅ | ✅ só consulta |
| Serviços: cadastrar, editar, pausar, categorias | ✅ | ❌ |
| **Financeiro** (faturamento e caixa) | ✅ | ❌ |
| **Equipe** (cadastrar colaboradora) | ✅ | ❌ |
| Desempenho e **PDI** das profissionais | ✅ | ❌ |
| **Minhas avaliações** (o que as clientes dizem dela) | — | ✅ (sem as anotações de PDI da dona) |

## Como o fluxo fica com o acesso

1. A cliente agenda e escolhe a profissional (ex.: Ana).
2. A dona (ou a própria Ana) aprova.
3. **A Ana termina o serviço e toca "Concluir atendimento" no celular dela.**
4. Quando a cliente abre o app de novo, aparece o pop-up **"Como foi seu atendimento com a Ana?"**, com estrelas, etiquetas e comentário. **Não é obrigatório:** tem o botão "Agora não", e ela pode avaliar depois em Meus horários.
5. A nota entra no perfil público da Ana e no **painel de desempenho** da dona.
6. Se aparecem avaliações ruins seguidas, a dona recebe o **alerta de atenção** e registra uma ação de **PDI** (conversa, treinamento, acompanhamento, reconhecimento).

## Por que vale para a dona (argumentos de venda)

- **Gestão a distância:** sabe quem atendeu, quem concluiu e como a cliente avaliou, sem estar no salão.
- **Feedback real, de quem foi atendida:** só avalia quem teve o atendimento concluído, uma vez por atendimento. Não dá para criar avaliação falsa.
- **Ação, não só nota:** alerta quando uma profissional cai, os elogios e reclamações mais repetidos e o histórico de PDI para acompanhar a evolução.
- **Segurança:** a profissional não vê faturamento, não mexe em preço e não cadastra ninguém.
- **Justiça com a equipe:** a dona pode esconder do app um comentário ofensivo, mas a nota continua contando. Ninguém "maquia" a avaliação, nem para cima nem para baixo.

## O que precisa para implementar (para o Claude do VS Code)

- Tabela `usuarios (id, nome, login, senha_hash, papel [dona|profissional], profissional_id, ativo)` e login por pessoa.
- **O servidor barra o que não é permitido.** Esconder botão na tela não basta: cada rota de admin confere o papel (ex.: `/admin/financeiro` só para a dona; `/admin/agendamentos/:id/concluir` só para a dona ou a profissional do atendimento).
- Registro de quem fez cada ação no histórico do agendamento (aprovou, reprovou, concluiu).
- No front: o painel mostra as abas conforme o papel (Pedidos, Agenda, Serviços só consulta, Minhas avaliações para a profissional).
- A dona cadastra a profissional e gera o acesso dela na tela Equipe. A profissional que sai da equipe tem o acesso desligado.

## O que já funciona hoje (para mostrar na apresentação)

- **Concluir atendimento** no painel (por enquanto, quem toca é a dona).
- **Pop-up de avaliação** quando a cliente abre o app depois do atendimento concluído, com **"Agora não"**.
- **Avaliação por profissional** (estrelas, quantidade e comentários no card) e o **painel de desempenho com alerta e PDI** para a dona.
- **Dois aparelhos ao vivo no link de apresentação do claude.ai:** celular com o painel do salão e computador com o app da cliente. Você conclui no celular e o pop-up aparece no computador.
