-- Radar Arbitrage — Supabase schema
-- Cole isto inteiro no SQL Editor do Supabase (Database > SQL Editor > New query) e rode uma vez.

-- Geração atômica de IDs "RA-###" no próprio Postgres, pra evitar corrida
-- entre criações concorrentes (duas abas/dispositivos criando ao mesmo tempo).
-- Precisa existir ANTES da tabela porque vira o valor padrão da coluna id.
create sequence if not exists opportunities_num_seq;

create or replace function next_opportunity_id() returns text as $$
declare
  next_num int;
  begin
    next_num := nextval('opportunities_num_seq');
      return 'RA-' || lpad(next_num::text, 3, '0');
      end;
      $$ language plpgsql;

      create table if not exists opportunities (
        id text primary key default next_opportunity_id(),
          category text not null default 'Outros',
            brand text not null default '',
              model text not null default '',
                source_platform text not null default '',
                  seller text not null default '',
                    asking_price numeric,
                      shipping numeric,
                        purchase_fees numeric,
                          maintenance_reserve numeric,
                            parts_reserve numeric,
                              safety_margin numeric,
                                fees numeric,
                                  selling_costs numeric,
                                    max_purchase numeric,
                                      quick_resale numeric,
                                        likely_resale numeric,
                                          liquidity numeric,
                                            condition numeric,
                                              originality numeric,
                                                completeness numeric,
                                                  iao numeric,
                                                    iam numeric,
                                                      ice numeric,
                                                        radar_score numeric,
                                                          auth_gate text not null default 'N/A',
                                                            capital_gate text not null default 'N/A',
                                                              condition_gate text not null default 'PENDENTE',
                                                                verdict text not null default 'EM ESTUDO',
                                                                  status text not null default 'Aprofundar',
                                                                    notes text not null default '',
                                                                      url text,
                                                                        validated boolean not null default false,
                                                                          origin text not null default 'manual',
                                                                            created_at timestamptz not null default now(),
                                                                              updated_at timestamptz not null default now()
                                                                              );

                                                                              create index if not exists opportunities_created_at_idx on opportunities (created_at desc);

                                                                              -- Trava a tabela pra acesso só via service_role (nunca exposta ao navegador).
                                                                              -- Sem policies criadas de propósito: RLS habilitado + zero policies = ninguém
                                                                              -- além do service_role (que ignora RLS) consegue ler ou escrever.
                                                                              alter table opportunities enable row level security;

                                                                              -- IMPORTANTE: depois de importar os dados existentes (passo "Colar do chat"
                                                                              -- na virada), rode isto UMA VEZ pra sincronizar a sequence com o maior
                                                                              -- "RA-###" já em uso — os itens migrados chegam com ID explícito (não usam
                                                                              -- o default), então a sequence continua em 1 até você rodar isto:
                                                                              --
                                                                              -- select setval(
                                                                              --   'opportunities_num_seq',
                                                                              --   greatest((select coalesce(max(substring(id from 4)::int), 0) from opportunities), 1)
                                                                              -- );
                                                                              
