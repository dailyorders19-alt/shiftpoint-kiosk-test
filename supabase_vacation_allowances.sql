create table if not exists public.vacation_allowances (
  employee_id text not null references public.employees(id) on delete cascade,
  year integer not null,
  entitled_days numeric(5, 1) not null default 0,
  carried_over_days numeric(5, 1) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (employee_id, year),
  constraint vacation_allowances_valid_year check (year between 2000 and 2100),
  constraint vacation_allowances_non_negative check (
    entitled_days >= 0 and carried_over_days >= 0
  )
);

create index if not exists vacation_allowances_year_idx
on public.vacation_allowances(year);

alter table public.vacation_allowances enable row level security;

drop policy if exists "Allow anon read vacation allowances" on public.vacation_allowances;
drop policy if exists "Allow anon insert vacation allowances" on public.vacation_allowances;
drop policy if exists "Allow anon update vacation allowances" on public.vacation_allowances;
drop policy if exists "Allow anon delete vacation allowances" on public.vacation_allowances;

create policy "Allow anon read vacation allowances"
on public.vacation_allowances for select
to anon
using (true);

create policy "Allow anon insert vacation allowances"
on public.vacation_allowances for insert
to anon
with check (true);

create policy "Allow anon update vacation allowances"
on public.vacation_allowances for update
to anon
using (true)
with check (true);

create policy "Allow anon delete vacation allowances"
on public.vacation_allowances for delete
to anon
using (true);
