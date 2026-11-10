-- Reflexão Bíblica: cole tudo no Supabase > SQL Editor > New query > Run

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  plan text not null default 'free',
  pro_until timestamptz,
  purchase_token text,
  created_at timestamptz not null default now()
);
create table if not exists public.kv (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create table if not exists public.shared_content (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create table if not exists public.usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.profiles enable row level security;
alter table public.kv enable row level security;
alter table public.shared_content enable row level security;
alter table public.usage enable row level security;

drop policy if exists "perfil próprio" on public.profiles;
create policy "perfil próprio" on public.profiles for select using (auth.uid() = id);

drop policy if exists "dados próprios" on public.kv;
create policy "dados próprios" on public.kv for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "conteúdo compartilhado: leitura" on public.shared_content;
create policy "conteúdo compartilhado: leitura" on public.shared_content for select using (true);
-- escrita em shared_content e usage só pelo servidor (service role)

-- cria o perfil automaticamente no primeiro login
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id) values (new.id) on conflict do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- contador diário de uso da IA
create or replace function public.take_quota(p_user uuid, p_limit int) returns boolean language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.usage (user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.usage.count + 1
  returning count into c;
  return c <= p_limit;
end; $$;
revoke execute on function public.take_quota(uuid, int) from anon, authenticated;
