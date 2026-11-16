-- Banco do sistema de agendamento do salão (um banco por salão). Rodar com o usuário dono do banco.
-- Dinheiro sempre em centavos (inteiro). Datas de atendimento em 'YYYY-MM-DD' e horas em 'HH:MM' (fuso de Belém).
create table if not exists categorias (
  id serial primary key,
  nome text not null unique,
  ordem int not null default 0
);
create table if not exists servicos (
  id serial primary key,
  categoria_id int not null references categorias(id),
  nome text not null,
  descricao text not null default '',
  duracao_min int not null check (duracao_min between 5 and 720),
  preco_centavos int not null check (preco_centavos >= 0),
  disponibilidade text not null default 'disponivel' check (disponibilidade in ('disponivel', 'pausado', 'oculto', 'arquivado')),
  foto_url text not null default '',
  opcoes jsonb not null default '[]',          -- [{nome, preco_centavos, duracao_min}]
  ordem int not null default 0,
  atualizado_em timestamptz not null default now()
);
create table if not exists profissionais (
  id text primary key,
  nome text not null,
  foto_url text not null default '',
  cor text not null default '#C99A87',
  categorias int[] not null default '{}',      -- ids de categorias que ela atende
  descricao text not null default '',
  inicio text not null default '09:00',
  fim text not null default '18:00',
  ativo boolean not null default true,         -- excluir = desativar (o histórico continua)
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create table if not exists clientes (
  id serial primary key,
  nome text not null,
  whatsapp text not null unique,               -- só dígitos, com DDD
  endereco text not null default '',
  foto_url text not null default '',
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create table if not exists agendamentos (
  id serial primary key,
  cliente_id int not null references clientes(id),
  profissional_id text not null references profissionais(id),
  dia date not null,
  inicio text not null,
  fim text not null,
  itens jsonb not null,                        -- [{chave, servico_id, opcao, nome, preco_centavos, duracao_min}] (cópia do momento do pedido)
  total_centavos int not null,
  pagamento text not null check (pagamento in ('pix', 'cartao', 'dinheiro')),
  status text not null check (status in ('aguardando_pix', 'aguardando', 'aprovado', 'reprovado', 'concluido')),
  motivo text not null default '',
  observacao text not null default '',
  reserva_ate timestamptz,                     -- Pix ainda não pago segura o horário até aqui
  mp_payment_id text,
  pix_pago_em timestamptz,
  pix_valor_centavos int,
  pix_pagador text,
  pix_teste boolean not null default false,
  estornado_em timestamptz,
  estorno_erro text,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists agendamentos_dia_prof on agendamentos (dia, profissional_id);
create index if not exists agendamentos_cliente on agendamentos (cliente_id);
create table if not exists historico (
  id serial primary key,
  agendamento_id int not null references agendamentos(id) on delete cascade,
  quando timestamptz not null default now(),
  quem text not null,
  o_que text not null
);
create index if not exists historico_ag on historico (agendamento_id);
create table if not exists caixas (
  id serial primary key,
  dia date not null unique,
  total_pix int not null,
  total_cartao int not null,
  total_dinheiro int not null,
  total int not null,
  fechado_em timestamptz not null default now()
);
create table if not exists lancamentos (
  id serial primary key,
  agendamento_id int unique references agendamentos(id),
  forma text not null check (forma in ('pix', 'cartao', 'dinheiro')),
  valor_centavos int not null,
  dia date not null,
  aprovado_em timestamptz not null default now(),
  recebido boolean not null default false,
  caixa_id int references caixas(id),
  nome text not null default '',               -- nome de quem pagou (lançamento de exemplo não tem agendamento)
  itens jsonb not null default '[]',
  exemplo boolean not null default false
);
create index if not exists lancamentos_dia on lancamentos (dia);
create table if not exists admins (
  id serial primary key,
  nome text not null,
  login text not null unique,
  salt text not null,
  senha_hash text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
create table if not exists admin_sessoes (
  token_hash text primary key,
  admin_id int not null references admins(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  ip text
);
create table if not exists pix_cobrancas (
  mp_id text primary key,
  agendamento_id int not null references agendamentos(id),
  valor_centavos int not null,
  status text not null default 'pending',
  teste boolean not null default false,
  criado_em timestamptz not null default now(),
  pago_em timestamptz
);
