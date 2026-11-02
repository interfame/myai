-- ═══════════════════════════════════════════════════════════════
-- MyAI · Esquema Supabase (PostgreSQL)
-- Alternativa al SQLite local: pega esto en Supabase → SQL Editor → Run.
--
-- Opción recomendada: mantener Prisma y solo cambiar el datasource
-- en prisma/schema.prisma a "postgresql" con tu DATABASE_URL de Supabase.
-- Esta SQL es la vía directa sin Prisma (misma estructura de tablas).
-- ═══════════════════════════════════════════════════════════════

create table if not exists "Setting" (
  "id"           text primary key default 'default',
  "botName"      text not null default 'MyAI',
  "userName"     text not null default 'Jefe',
  "systemPrompt" text not null default '',
  "autoLearn"    boolean not null default true,
  "colabUrl"     text,
  "colabSecret"  text,
  "updatedAt"    timestamptz not null default now()
);

create table if not exists "Conversation" (
  "id"        text primary key default gen_random_uuid()::text,
  "title"     text not null default 'Nueva conversación',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Message" (
  "id"             text primary key default gen_random_uuid()::text,
  "conversationId" text not null references "Conversation"("id") on delete cascade,
  "role"           text not null,
  "content"        text not null,
  "createdAt"      timestamptz not null default now()
);

create index if not exists "Message_conversation_created_idx"
  on "Message"("conversationId", "createdAt");

create table if not exists "Learning" (
  "id"               text primary key default gen_random_uuid()::text,
  "content"          text not null,
  "category"         text not null default 'general',
  "source"           text not null default 'auto',
  "strength"         integer not null default 1,
  "active"           boolean not null default true,
  "createdAt"        timestamptz not null default now(),
  "lastReinforcedAt" timestamptz not null default now()
);

create index if not exists "Learning_active_strength_idx"
  on "Learning"("active", "strength" desc);

-- Fila inicial de ajustes
insert into "Setting" ("id") values ('default') on conflict do nothing;

-- 🔒 Seguridad: como el backend habla con la service_role key (bypasea RLS),
-- puedes activar RLS sin policies para bloquear acceso directo desde clientes:
-- alter table "Setting" enable row level security;
-- alter table "Conversation" enable row level security;
-- alter table "Message" enable row level security;
-- alter table "Learning" enable row level security;
