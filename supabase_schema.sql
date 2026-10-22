-- ========================================================
-- TABLA DE INSCRIPCIONES: ECORUTA HUELLAS DEL ALMA 10K
-- ========================================================
-- Instrucciones:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com).
-- 2. En el menú lateral izquierdo, haz clic en "SQL Editor".
-- 3. Haz clic en "New query".
-- 4. Copia y pega TODO este código.
-- 5. Haz clic en el botón verde "RUN".
-- ========================================================

-- Crear tabla de inscripciones
create table if not exists public.inscripciones (
  id text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  fecha text not null,
  nombre text not null,
  cedula text not null,
  telefono text not null,
  ruta text not null default '10K',
  tipo_camiseta text not null default 'Caballero',
  talla_camiseta text not null default 'M',
  valor_pagado numeric not null default 140000,
  tipo_sangre text default '',
  contacto_emergencia_nombre text default '',
  contacto_emergencia_telefono text default '',
  referencia_pago text default '',
  comprobante text default null,
  estado text not null default 'Confirmado'
);

-- Habilitar Seguridad de Nivel de Fila (RLS)
alter table public.inscripciones enable row level security;

-- Políticas de acceso para permitir inscripciones y consulta desde el panel
drop policy if exists "Permitir lectura publica de inscripciones" on public.inscripciones;
create policy "Permitir lectura publica de inscripciones" on public.inscripciones
  for select using (true);

drop policy if exists "Permitir insercion publica de inscripciones" on public.inscripciones;
create policy "Permitir insercion publica de inscripciones" on public.inscripciones
  for insert with check (true);

drop policy if exists "Permitir actualizacion de inscripciones" on public.inscripciones;
create policy "Permitir actualizacion de inscripciones" on public.inscripciones
  for update using (true);

drop policy if exists "Permitir eliminacion de inscripciones" on public.inscripciones;
create policy "Permitir eliminacion de inscripciones" on public.inscripciones
  for delete using (true);
