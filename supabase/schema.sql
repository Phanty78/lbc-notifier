-- State des annonces déjà vues par lbc-notifier.
-- À exécuter une fois dans le SQL editor du projet Supabase.
-- Connexion directe (user postgres = superuser) -> RLS non applicable.
create table if not exists public.seen_ads (
  id bigint primary key,
  first_seen_at timestamptz not null default now()
);